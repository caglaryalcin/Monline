const { DataRecord } = require("./storage.cjs");
const {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
} = require("./errors.cjs");
const { rateLimit } = require("express-rate-limit");
const { payerOptions, applyPayer } = require("./sharing-payers.cjs");
const consent = require("./sharing-consent.cjs");
const {
  subscriptionRecipients,
  notifyNewRecipients,
} = require("./sharing-notifications.cjs");

const ids = (value) =>
  Array.isArray(value) ? value.filter((id) => typeof id === "string") : [];

function subscriptionPermission(repository, subscription, userId) {
  if (subscription.getString("user") === userId) return "owner";
  const sharing = subscription.get("sharing");
  if (!sharing || typeof sharing !== "object" || sharing.enabled === false)
    return null;
  const directAccess = ids(sharing.users).includes(userId);
  if (directAccess && sharing.userPermissions?.[userId] === "edit")
    return "edit";
  let permission = directAccess ? "read" : null;
  const groups = repository.findRecordsByFilter(
    "sharing_groups",
    "user = {:owner}",
    "",
    0,
    0,
    {
      owner: subscription.getString("user"),
    },
  );
  for (const group of groups) {
    if (
      !ids(sharing.groups).includes(group.id) ||
      sharing.groupEnabled?.[group.id] === false ||
      !ids(group.get("members")).includes(userId)
    )
      continue;
    if (sharing.groupPermissions?.[group.id] === "edit") return "edit";
    permission = "read";
  }
  return permission;
}

function canReadSubscription(repository, subscription, userId) {
  return subscriptionPermission(repository, subscription, userId) !== null;
}

function isSubscriptionShared(repository, subscription) {
  const sharing = subscription.get("sharing") || {};
  if (sharing.enabled === false) return false;
  if (
    [...ids(sharing.users), ...ids(sharing.pendingUsers)].some((id) =>
      repository.countRecords("users", "id = {:id}", { id }),
    )
  )
    return true;
  return repository
    .findRecordsByFilter("sharing_groups", "user = {:owner}", "", 0, 0, {
      owner: subscription.getString("user"),
    })
    .some(
      (group) =>
        ids(sharing.groups).includes(group.id) &&
        sharing.groupEnabled?.[group.id] !== false &&
        [
          ...ids(group.get("members")),
          ...ids(group.get("pending_members")),
        ].some((id) => repository.countRecords("users", "id = {:id}", { id })),
    );
}

function registerSharingApi(app, repository, auth) {
  const owned = (collection, id, userId) => {
    const record = repository.findRecordById(collection, id);
    if (record.getString("user") !== userId) throw new NotFoundError();
    return record;
  };
  const members = (userIds) =>
    ids(userIds).flatMap((id) => {
      try {
        const user = repository.findRecordById("users", id);
        return [
          { id, name: user.getString("name"), email: user.getString("email") },
        ];
      } catch {
        return [];
      }
    });
  const resolveEmails = (emails, ownerId) => {
    if (
      !Array.isArray(emails) ||
      emails.length > 100 ||
      emails.some((email) => typeof email !== "string")
    )
      throw new BadRequestError("sharing_invalid_users");
    return [
      ...new Set(
        emails.map((email) => email.trim().toLowerCase()).filter(Boolean),
      ),
    ].map((email) => {
      const row = repository.connection
        .prepare("SELECT id FROM users WHERE email = ? COLLATE NOCASE")
        .get(email);
      if (!row) throw new BadRequestError("sharing_user_not_found");
      if (row.id === ownerId)
        throw new BadRequestError("sharing_cannot_add_self");
      return row.id;
    });
  };
  const groupOutput = (group) => ({
    id: group.id,
    name: group.getString("name"),
    members: members(group.get("members")).map((user) => ({
      ...user,
      status: "active",
    })),
    pendingMembers: members(group.get("pending_members")).map((user) => ({
      ...user,
      status: "pending",
    })),
  });
  const sharingOutput = (sub) => {
    const sharing = sub.get("sharing") || {};
    const ownerGroups = repository.findRecordsByFilter(
      "sharing_groups",
      "user = {:owner}",
      "",
      0,
      0,
      { owner: sub.getString("user") },
    );
    const groups = ids(sharing.groups).filter((id) =>
      ownerGroups.some((group) => group.id === id),
    );
    const users = members([
      ...ids(sharing.users),
      ...ids(sharing.pendingUsers),
    ]).map((user) => ({
      ...user,
      status: ids(sharing.pendingUsers).includes(user.id)
        ? "pending"
        : "active",
    }));
    return {
      users,
      enabled: sharing.enabled !== false,
      userPermissions: Object.fromEntries(
        users.map((user) => [
          user.email.toLowerCase(),
          sharing.userPermissions?.[user.id] === "edit" ? "edit" : "read",
        ]),
      ),
      groups,
      groupPermissions: Object.fromEntries(
        groups.map((id) => [
          id,
          sharing.groupPermissions?.[id] === "edit" ? "edit" : "read",
        ]),
      ),
      groupEnabled: Object.fromEntries(
        groups.map((id) => [id, sharing.groupEnabled?.[id] !== false]),
      ),
      is_shared: isSubscriptionShared(repository, sub),
      pending_count: new Set([
        ...ids(sharing.pendingUsers),
        ...ownerGroups
          .filter(
            (group) =>
              groups.includes(group.id) &&
              sharing.groupEnabled?.[group.id] !== false,
          )
          .flatMap((group) => ids(group.get("pending_members"))),
      ]).size,
    };
  };
  app.use(
    "/api/sharing",
    (req, res, next) => {
      try {
        auth.requireUser(req);
        next();
      } catch (error) {
        next(error);
      }
    },
    rateLimit({
      windowMs: 60 * 1000,
      limit: 120,
      standardHeaders: "draft-8",
      legacyHeaders: false,
    }),
  );

  app.get("/api/sharing/groups", (req, res) => {
    res.json(
      repository
        .findRecordsByFilter(
          "sharing_groups",
          "user = {:user}",
          "name,id",
          0,
          0,
          { user: req.user.id },
        )
        .map(groupOutput),
    );
  });
  async function saveGroup(req, res, create) {
    const group = create
      ? new DataRecord(repository.findCollectionByNameOrId("sharing_groups"))
      : owned("sharing_groups", req.params.id, req.user.id);
    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
    if (!name || name.length > 100)
      throw new BadRequestError("sharing_invalid_group_name");
    if (
      create &&
      repository.countRecords("sharing_groups", "user = {:user}", {
        user: req.user.id,
      }) >= 100
    )
      throw new BadRequestError("sharing_group_limit");
    const memberIds = resolveEmails(req.body?.memberEmails, req.user.id);
    const newlyShared = !create
      ? repository
          .findRecordsByFilter(
            "subscriptions",
            "user = {:owner} && sharing != null",
            "",
            0,
            0,
            { owner: req.user.id },
          )
          .filter((sub) => ids(sub.get("sharing")?.groups).includes(group.id))
          .map((sub) => ({
            sub,
            previous: subscriptionRecipients(repository, sub),
          }))
      : [];
    let plan;
    repository.runInTransaction(() => {
      plan = consent.prepareContacts(
        repository,
        req.user,
        memberIds,
        new Set(
          memberIds.filter(
            (id) => !ids(group.get("pending_members")).includes(id),
          ),
        ),
      );
      group.set("user", req.user.id);
      group.set("name", name);
      group.set(
        "members",
        memberIds.filter((id) => plan.confirmed.has(id)),
      );
      group.set(
        "pending_members",
        memberIds.filter((id) => !plan.confirmed.has(id)),
      );
      repository.save(group);
    });
    const invitationFailures = await consent.deliverContacts(
      repository,
      plan.deliveries,
    );
    for (const { sub, previous } of newlyShared)
      await notifyNewRecipients(repository, sub, previous, req.user);
    res.status(create ? 201 : 200).json({
      ...groupOutput(group),
      invitation_delivery_failures: invitationFailures,
    });
  }
  app.post("/api/sharing/groups", (req, res) => saveGroup(req, res, true));
  app.put("/api/sharing/groups/:id", (req, res) => saveGroup(req, res, false));
  app.delete("/api/sharing/groups/:id", (req, res) => {
    repository.delete(owned("sharing_groups", req.params.id, req.user.id));
    res.status(204).end();
  });
  app.get("/api/sharing/subscriptions/:id", (req, res) => {
    res.json(sharingOutput(owned("subscriptions", req.params.id, req.user.id)));
  });
  app.get("/api/sharing/subscriptions/:id/payers", (req, res) => {
    const sub = repository.findRecordById("subscriptions", req.params.id);
    const permission = subscriptionPermission(repository, sub, req.user.id);
    if (!permission) throw new NotFoundError();
    if (permission !== "owner" && permission !== "edit")
      throw new ForbiddenError("sharing_edit_forbidden");
    res.json(payerOptions(repository, sub, req.user.id));
  });
  app.patch("/api/sharing/subscriptions/:id/enabled", (req, res) => {
    const sub = owned("subscriptions", req.params.id, req.user.id);
    if (
      typeof req.body?.enabled !== "boolean" ||
      Object.keys(req.body).some((key) => key !== "enabled")
    )
      throw new BadRequestError("sharing_invalid_enabled");
    sub.set("sharing", {
      ...(sub.get("sharing") || {}),
      enabled: req.body.enabled,
    });
    repository.save(sub);
    res.json(sharingOutput(sub));
  });
  app.put("/api/sharing/subscriptions/:id", async (req, res) => {
    const sub = owned("subscriptions", req.params.id, req.user.id);
    const users = resolveEmails(req.body?.userEmails, req.user.id);
    const groups = req.body?.groupIds;
    if (
      !Array.isArray(groups) ||
      groups.length > 100 ||
      groups.some((id) => typeof id !== "string")
    )
      throw new BadRequestError("sharing_invalid_groups");
    const selectedGroups = [...new Set(groups)].map((id) =>
      owned("sharing_groups", id, req.user.id),
    );
    const enabledInput = req.body?.groupEnabled;
    if (
      enabledInput !== undefined &&
      (!enabledInput ||
        typeof enabledInput !== "object" ||
        Array.isArray(enabledInput) ||
        Object.entries(enabledInput).some(
          ([id, enabled]) =>
            !groups.includes(id) || typeof enabled !== "boolean",
        ))
    )
      throw new BadRequestError("sharing_invalid_groups");
    const storedSharing = sub.get("sharing") || {};
    const groupEnabled = Object.fromEntries(
      groups.map((id) => [
        id,
        enabledInput === undefined
          ? storedSharing.groupEnabled?.[id] !== false
          : enabledInput[id] !== false,
      ]),
    );
    const permissions = req.body?.groupPermissions ?? {};
    if (
      !permissions ||
      typeof permissions !== "object" ||
      Array.isArray(permissions) ||
      Object.entries(permissions).some(
        ([id, permission]) =>
          !groups.includes(id) || !["read", "edit"].includes(permission),
      )
    )
      throw new BadRequestError("sharing_invalid_permissions");
    const groupPermissions = Object.fromEntries(
      groups.map((id) => [id, permissions[id] === "edit" ? "edit" : "read"]),
    );
    const directPermissions = req.body?.userPermissions ?? {};
    const selectedEmails = new Set(
      users.map((id) =>
        repository.findRecordById("users", id).getString("email").toLowerCase(),
      ),
    );
    if (
      !directPermissions ||
      typeof directPermissions !== "object" ||
      Array.isArray(directPermissions) ||
      Object.keys(directPermissions).length > 100 ||
      Object.entries(directPermissions).some(
        ([email, permission]) =>
          !selectedEmails.has(email.trim().toLowerCase()) ||
          !["read", "edit"].includes(permission),
      )
    )
      throw new BadRequestError("sharing_invalid_permissions");
    const normalizedPermissions = new Map(
      Object.entries(directPermissions).map(([email, permission]) => [
        email.trim().toLowerCase(),
        permission,
      ]),
    );
    const userPermissions = Object.fromEntries(
      users.map((id) => [
        id,
        normalizedPermissions.get(
          repository
            .findRecordById("users", id)
            .getString("email")
            .toLowerCase(),
        ) === "edit"
          ? "edit"
          : "read",
      ]),
    );
    const previousRecipients = subscriptionRecipients(repository, sub);
    const previousSharing = sub.get("sharing") || {};
    const previousSelected = new Set([
      ...ids(previousSharing.users),
      ...ids(previousSharing.pendingUsers),
    ]);
    const forceIds = new Set(
      users.filter(
        (id) =>
          ids(previousSharing.users).includes(id) ||
          !previousSelected.has(id) ||
          userPermissions[id] !==
            (previousSharing.userPermissions?.[id] || "read"),
      ),
    );
    for (const group of selectedGroups)
      if (
        groupEnabled[group.id] &&
        (!ids(previousSharing.groups).includes(group.id) ||
          previousSharing.groupEnabled?.[group.id] === false ||
          groupPermissions[group.id] !==
            (previousSharing.groupPermissions?.[group.id] || "read"))
      )
        for (const id of [
          ...ids(group.get("members")),
          ...ids(group.get("pending_members")),
        ])
          forceIds.add(id);
    for (const group of selectedGroups)
      for (const id of ids(group.get("members"))) forceIds.add(id);
    let plan;
    repository.runInTransaction(() => {
      plan = consent.prepareContacts(
        repository,
        req.user,
        [
          ...users,
          ...selectedGroups.flatMap((group) => [
            ...ids(group.get("members")),
            ...ids(group.get("pending_members")),
          ]),
        ],
        forceIds,
      );
      for (const group of selectedGroups) {
        const allMembers = [
          ...new Set([
            ...ids(group.get("members")),
            ...ids(group.get("pending_members")),
          ]),
        ];
        group.set(
          "members",
          allMembers.filter((id) => plan.confirmed.has(id)),
        );
        group.set(
          "pending_members",
          allMembers.filter((id) => !plan.confirmed.has(id)),
        );
        repository.save(group);
      }
      sub.set("sharing", {
        enabled: previousSharing.enabled !== false,
        users: users.filter((id) => plan.confirmed.has(id)),
        pendingUsers: users.filter((id) => !plan.confirmed.has(id)),
        groups: [...new Set(groups)],
        groupPermissions,
        groupEnabled,
        userPermissions,
      });
      repository.save(sub);
    });
    const invitationFailures = await consent.deliverContacts(
      repository,
      plan.deliveries,
    );
    await notifyNewRecipients(repository, sub, previousRecipients, req.user);
    res.json({
      ...sharingOutput(sub),
      invitation_delivery_failures: invitationFailures,
    });
  });
  app.patch("/api/sharing/shared-subscriptions/:id", (req, res) => {
    const sub = repository.findRecordById("subscriptions", req.params.id);
    const permission = subscriptionPermission(repository, sub, req.user.id);
    if (!permission) throw new NotFoundError();
    if (permission !== "edit" && permission !== "owner")
      throw new ForbiddenError("sharing_edit_forbidden");
    // Payer changes resolve to an owner-owned person. Other private relations,
    // ownership, access grants and payment history stay owner-controlled.
    const body = req.body;
    const allowed = new Set([
      "name",
      "price",
      "cycle",
      "frequency",
      "next_payment",
      "auto_renew",
      "inactive",
      "notes",
      "payer",
    ]);
    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body) ||
      Object.keys(body).some((key) => !allowed.has(key))
    )
      throw new BadRequestError("sharing_invalid_edit");
    for (const [key, value] of Object.entries(body)) {
      if (["auto_renew", "inactive"].includes(key)) {
        if (typeof value !== "boolean")
          throw new BadRequestError("sharing_invalid_edit");
      } else if (["price", "frequency"].includes(key)) {
        if (
          typeof value !== "number" ||
          !Number.isFinite(value) ||
          value < (key === "frequency" ? 1 : 0) ||
          (key === "frequency" && !Number.isSafeInteger(value))
        )
          throw new BadRequestError("sharing_invalid_edit");
      } else if (typeof value !== "string")
        throw new BadRequestError("sharing_invalid_edit");
      if (
        key === "next_payment" &&
        (!/^\d{4}-\d{2}-\d{2}$/.test(value) ||
          !Number.isFinite(Date.parse(value)) ||
          new Date(value).toISOString().slice(0, 10) !== value)
      )
        throw new BadRequestError("sharing_invalid_edit");
      if (key !== "payer") sub.set(key, key === "name" ? value.trim() : value);
    }
    if (
      sub.getString("end_date") &&
      sub.getString("next_payment").slice(0, 10) >
        sub.getString("end_date").slice(0, 10)
    )
      throw new BadRequestError("sharing_invalid_edit");
    const cycleError =
      require("./domain/lib/record-type-helpers.js").applyRecordTypeToRecord(
        repository,
        sub,
        sub.getString("record_type"),
      );
    if (cycleError) throw new BadRequestError("sharing_invalid_edit");
    if (
      (sub.getFloat("payment_limit") > 0 || sub.getString("end_date")) &&
      sub.getString("record_type") !== "credit"
    ) {
      sub.set("auto_renew", true);
      if (
        sub.getFloat("payment_limit") > 0 &&
        sub.getFloat("payments_completed") >= sub.getFloat("payment_limit")
      )
        sub.set("inactive", true);
    }
    repository.runInTransaction(() => {
      if (Object.hasOwn(body, "payer"))
        applyPayer(repository, sub, body.payer, req.user.id);
      repository.emit(
        "updateRequest",
        sub,
        () => repository.save(sub),
        req.user,
      );
    });
    res.json({ id: sub.id });
  });
  app.get("/api/sharing/shared-subscriptions", (req, res) => {
    const subscriptions = repository.findRecordsByFilter(
      "subscriptions",
      "user != {:user} && sharing != null",
      "name,id",
      0,
      0,
      { user: req.user.id },
    );
    res.json(
      subscriptions
        .filter((sub) => canReadSubscription(repository, sub, req.user.id))
        .map((sub) => {
          // Share the item and its payer's display name, never private payment
          // methods, other household members, proofs, history or access lists.
          const data = {};
          data.permission = subscriptionPermission(
            repository,
            sub,
            req.user.id,
          );
          data.is_shared = true;
          for (const field of [
            "id",
            "user",
            "name",
            "logo",
            "price",
            "currency",
            "cycle",
            "category",
            "payer",
            "frequency",
            "next_payment",
            "start_date",
            "auto_renew",
            "inactive",
            "notes",
            "url",
            "end_date",
            "payment_limit",
            "payments_completed",
            "record_type",
          ])
            data[field] = sub.get(field);
          data.expand = {};
          for (const [field, collection, fields] of [
            ["currency", "currencies", ["id", "name", "code", "symbol"]],
            ["cycle", "cycles", ["id", "name"]],
            ["category", "categories", ["id", "name", "translation_key"]],
            ["payer", "household", ["id", "name", "user"]],
          ]) {
            try {
              const related = repository.findRecordById(
                collection,
                sub.getString(field),
              );
              if (
                collection !== "cycles" &&
                related.getString("user") !== sub.getString("user")
              )
                continue;
              data.expand[field] = Object.fromEntries(
                fields.map((key) => [key, related.get(key)]),
              );
            } catch {
              /* A deleted relation should not hide the shared item. */
            }
          }
          try {
            data.owner_name = repository
              .findRecordById("users", sub.getString("user"))
              .getString("name");
          } catch {
            data.owner_name = "";
          }
          return data;
        }),
    );
  });
}

module.exports = {
  canReadSubscription,
  isSubscriptionShared,
  subscriptionPermission,
  registerSharingApi,
};
