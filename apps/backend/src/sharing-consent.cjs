const crypto = require("node:crypto");
const { DataRecord } = require("./storage.cjs");
const { BadRequestError } = require("./errors.cjs");

const ids = (value) =>
  Array.isArray(value) ? value.filter((id) => typeof id === "string") : [];

function prepareContacts(
  repository,
  owner,
  recipientIds,
  forceIds = new Set(),
) {
  const people = require("./people-invitations.cjs");
  const contacts = repository.findRecordsByFilter(
    "household",
    "user = {:owner}",
    "",
    0,
    0,
    { owner: owner.id },
  );
  const confirmed = new Set(),
    deliveries = [];
  for (const id of new Set(recipientIds)) {
    const recipient = repository.findRecordById("users", id);
    if (recipient.getBool("disabled"))
      throw new BadRequestError("sharing_user_not_found");
    const email = recipient.getString("email").trim().toLowerCase();
    let person = contacts.find(
      (item) =>
        item.getString("account") === id ||
        people.personEmail(repository, item) === email,
    );
    if (person && people.isPersonConfirmed(repository, person)) {
      // A previously approved email can later acquire a registered account.
      if (
        !person.getString("account") &&
        people.personEmail(repository, person) === email
      ) {
        person.set("account", id);
        person.set("account_approval", {
          ...person.get("account_approval"),
          account_id: id,
        });
        repository.save(person);
      }
      confirmed.add(id);
      continue;
    }
    if (!person) {
      person = new DataRecord(repository.findCollectionByNameOrId("household"));
      person.set("user", owner.id);
      person.set("name", recipient.getString("name") || email);
      contacts.push(person);
    }
    const invitation = people.prepareInvitation(repository, person, email, {
      force: forceIds.has(id),
    });
    if (!person.id || invitation) repository.save(person);
    if (invitation) deliveries.push({ person, invitation });
  }
  return { confirmed, deliveries };
}

async function deliverContacts(repository, deliveries) {
  const { deliverInvitation } = require("./people-invitations.cjs");
  let cursor = 0;
  async function deliver() {
    while (cursor < deliveries.length) {
      const { person, invitation } = deliveries[cursor++];
      await deliverInvitation(repository, person, invitation);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(4, deliveries.length) }, deliver),
  );
  return deliveries.filter(
    ({ person }) =>
      person.get("account_approval")?.delivery_status === "failed",
  ).length;
}

function pendingRequests(repository, person) {
  const accountId = person.getString("account"),
    owner = person.getString("user");
  const groups = accountId
    ? repository
        .findRecordsByFilter("sharing_groups", "user = {:owner}", "id", 0, 0, {
          owner,
        })
        .filter((group) =>
          ids(group.get("pending_members")).includes(accountId),
        )
    : [];
  const groupIds = new Set(groups.map((group) => group.id));
  const subscriptions = accountId
    ? repository
        .findRecordsByFilter(
          "subscriptions",
          "user = {:owner} && sharing != null",
          "id",
          0,
          0,
          { owner },
        )
        .flatMap((sub) => {
          const sharing = sub.get("sharing") || {};
          if (sharing.enabled === false) return [];
          const direct = ids(sharing.pendingUsers).includes(accountId);
          const selectedGroups = ids(sharing.groups).filter(
            (id) => groupIds.has(id) && sharing.groupEnabled?.[id] !== false,
          );
          if (!direct && !selectedGroups.length) return [];
          const canEdit =
            (direct && sharing.userPermissions?.[accountId] === "edit") ||
            selectedGroups.some(
              (id) => sharing.groupPermissions?.[id] === "edit",
            );
          return [
            {
              id: sub.id,
              name: sub.getString("name"),
              permission: canEdit ? "edit" : "read",
            },
          ];
        })
    : [];
  return {
    subscriptions,
    groups: groups.map((group) => ({
      id: group.id,
      name: group.getString("name"),
    })),
  };
}

function requestScope(repository, person) {
  const requests = pendingRequests(repository, person);
  return {
    requests,
    digest: crypto
      .createHash("sha256")
      .update(JSON.stringify(requests))
      .digest("hex"),
  };
}

function activateRequests(repository, person) {
  const accountId = person.getString("account"),
    owner = person.getString("user");
  if (!accountId) return;
  for (const sub of repository.findRecordsByFilter(
    "subscriptions",
    "user = {:owner} && sharing != null",
    "",
    0,
    0,
    { owner },
  )) {
    const sharing = sub.get("sharing") || {};
    if (!ids(sharing.pendingUsers).includes(accountId)) continue;
    sub.set("sharing", {
      ...sharing,
      users: [...new Set([...ids(sharing.users), accountId])],
      pendingUsers: ids(sharing.pendingUsers).filter((id) => id !== accountId),
    });
    repository.save(sub);
  }
  for (const group of repository.findRecordsByFilter(
    "sharing_groups",
    "user = {:owner}",
    "",
    0,
    0,
    { owner },
  )) {
    if (!ids(group.get("pending_members")).includes(accountId)) continue;
    group.set("members", [
      ...new Set([...ids(group.get("members")), accountId]),
    ]);
    group.set(
      "pending_members",
      ids(group.get("pending_members")).filter((id) => id !== accountId),
    );
    repository.save(group);
  }
}

function removeContactAccess(repository, person) {
  const owner = person.getString("user");
  let recipient = person.getString("account");
  if (!recipient) {
    const email = require("./people-invitations.cjs").personEmail(
      repository,
      person,
    );
    recipient =
      repository.connection
        .prepare("SELECT id FROM users WHERE email=? COLLATE NOCASE")
        .get(email)?.id || "";
  }
  if (!recipient || recipient === owner) return;
  for (const sub of repository.findRecordsByFilter(
    "subscriptions",
    "user = {:owner} && sharing != null",
    "",
    0,
    0,
    { owner },
  )) {
    const sharing = sub.get("sharing") || {};
    if (
      !ids(sharing.users).includes(recipient) &&
      !ids(sharing.pendingUsers).includes(recipient) &&
      !Object.hasOwn(sharing.userPermissions || {}, recipient)
    )
      continue;
    const userPermissions = { ...sharing.userPermissions };
    delete userPermissions[recipient];
    sub.set("sharing", {
      ...sharing,
      users: ids(sharing.users).filter((id) => id !== recipient),
      pendingUsers: ids(sharing.pendingUsers).filter((id) => id !== recipient),
      userPermissions,
    });
    repository.save(sub);
  }
  for (const group of repository.findRecordsByFilter(
    "sharing_groups",
    "user = {:owner}",
    "",
    0,
    0,
    { owner },
  )) {
    if (
      !ids(group.get("members")).includes(recipient) &&
      !ids(group.get("pending_members")).includes(recipient)
    )
      continue;
    group.set(
      "members",
      ids(group.get("members")).filter((id) => id !== recipient),
    );
    group.set(
      "pending_members",
      ids(group.get("pending_members")).filter((id) => id !== recipient),
    );
    repository.save(group);
  }
}

module.exports = {
  prepareContacts,
  deliverContacts,
  pendingRequests,
  requestScope,
  activateRequests,
  removeContactAccess,
};
