const crypto = require("node:crypto");
const escapeHtml = require("escape-html");
const { rateLimit } = require("express-rate-limit");
const { isValidEmail } = require("./email.cjs");
const { BadRequestError, NotFoundError } = require("./errors.cjs");
const { brandedMessage } = require("./email-templates.cjs");
const consent = require("./sharing-consent.cjs");

const INVITATION_LIFETIME = 7 * 24 * 60 * 60 * 1000;
const hash = (value) => crypto.createHash("sha256").update(value).digest("hex");
const normalizeEmail = (value) =>
  String(value || "")
    .trim()
    .toLowerCase();

function linkedAccount(repository, person) {
  try {
    return repository.findRecordById("users", person.getString("account"));
  } catch {
    return null;
  }
}

function personEmail(repository, person) {
  const account = linkedAccount(repository, person);
  if (account?.id === person.getString("user"))
    return normalizeEmail(account.getString("email"));
  return normalizeEmail(
    person.get("account_approval")?.email || account?.getString("email"),
  );
}

function isPersonConfirmed(repository, person) {
  const account = linkedAccount(repository, person);
  if (account?.getBool("disabled")) return false;
  if (account?.id === person.getString("user")) return true;
  const approval = person.get("account_approval");
  return !!(
    approval?.approved_at &&
    approval.owner_id === person.getString("user") &&
    approval.account_id === (account?.id || "") &&
    isValidEmail(approval.email) &&
    (!account || normalizeEmail(account.getString("email")) === approval.email)
  );
}

function invitationState(repository, person) {
  if (isPersonConfirmed(repository, person)) return "confirmed";
  const approval = person.get("account_approval");
  if (!approval?.token_hash || approval.approved_at) return "not_requested";
  if (approval.expires_at <= Date.now()) return "expired";
  if (approval.delivery_status === "failed") return "delivery_failed";
  return "pending";
}

function invitationBase(repository) {
  if (!repository.settings().smtp.enabled)
    throw new BadRequestError("people_invitation_smtp_required");
  const url = require("./public-url.cjs").publicUrl(
    repository,
    "/api/people/confirm",
  );
  if (!url) throw new BadRequestError("people_invitation_url_required");
  return url;
}

function prepareInvitation(repository, person, email, { force = false } = {}) {
  if (typeof email !== "string" || !isValidEmail(normalizeEmail(email)))
    throw new BadRequestError("household_invalid_account_email");
  email = normalizeEmail(email);
  const ownerId = person.getString("user");
  const accountRow = repository.connection
    .prepare("SELECT id FROM users WHERE email=? COLLATE NOCASE")
    .get(email);
  const account = accountRow
    ? repository.findRecordById("users", accountRow.id)
    : null;
  if (account?.getBool("disabled"))
    throw new BadRequestError("people_invitation_account_unavailable");
  const duplicate = repository
    .findRecordsByFilter("household", "user = {:owner}", "", 0, 0, {
      owner: ownerId,
    })
    .some(
      (other) =>
        other.id !== person.id && personEmail(repository, other) === email,
    );
  if (duplicate) throw new BadRequestError("household_account_already_linked");
  const original = person.original();
  const prior = original.get("account_approval");
  person.set("account", account?.id || "");
  if (!person.getString("name").trim())
    person.set("name", account?.getString("name").trim() || email);
  if (account?.id === ownerId) {
    person.set("account_approval", null);
    return null;
  }
  if (
    !force &&
    prior?.email === email &&
    original.getString("account") === (account?.id || "") &&
    (isPersonConfirmed(repository, original) ||
      (prior.token_hash &&
        prior.expires_at > Date.now() &&
        prior.delivery_status !== "failed"))
  )
    return null;
  const url = invitationBase(repository);
  const token = crypto.randomBytes(32).toString("base64url");
  // Resending the same invitation keeps earlier, unexpired links usable.
  // Changing the recipient or owner discards all earlier links.
  const sameRecipient =
    prior?.email === email &&
    prior.owner_id === ownerId &&
    original.getString("account") === (account?.id || "");
  const previousTokens = sameRecipient
    ? [
        { hash: prior.token_hash, expires_at: prior.expires_at },
        ...(Array.isArray(prior.previous_tokens) ? prior.previous_tokens : []),
      ]
        .filter(
          (entry) =>
            typeof entry.hash === "string" &&
            entry.hash &&
            entry.expires_at > Date.now(),
        )
        .slice(0, 10)
    : [];
  const approval = {
    email,
    owner_id: ownerId,
    account_id: account?.id || "",
    approved_at: "",
    token_hash: hash(token),
    expires_at: Date.now() + INVITATION_LIFETIME,
    sent_at: new Date().toISOString(),
    delivery_status: "sending",
    previous_tokens: previousTokens,
  };
  person.set("account_approval", approval);
  url.searchParams.set("token", token);
  return { url: url.href, tokenHash: approval.token_hash };
}

function requestDetails(requests, tr) {
  const subscriptions = requests?.subscriptions || [],
    groups = requests?.groups || [];
  const items = [
    ...subscriptions.map(
      (sub) =>
        sub.name +
        " — " +
        (sub.permission === "edit"
          ? tr
            ? "Düzenleyebilir"
            : "Can edit"
          : tr
            ? "Yalnızca okuma"
            : "Read only"),
    ),
    ...groups.map((group) => (tr ? "Grup: " : "Group: ") + group.name),
  ];
  return {
    text: items.length ? "\n\n" + items.join("\n") : "",
    html: items.length
      ? '<ul style="padding-left:20px">' +
        items.map((item) => "<li>" + escapeHtml(item) + "</li>").join("") +
        "</ul>"
      : "",
  };
}

function invitationMessage({ from, to, senderName, language, url, requests }) {
  const tr = String(language || "en")
    .toLowerCase()
    .startsWith("tr");
  const hasSharing = !!(
    requests?.subscriptions.length || requests?.groups.length
  );
  const body = hasSharing
    ? tr
      ? senderName +
        " sizinle Monline üzerinden paylaşım yapmak ve sizi kişi listesine eklemek istiyor. Onaylıyor musunuz?"
      : senderName +
        " wants to share with you on Monline and add you to their people list. Do you approve?"
    : tr
      ? senderName +
        " sizi Monline kişi listesine eklemek istiyor. Onaylıyor musunuz?"
      : senderName +
        " wants to add you to their Monline people list. Do you approve?";
  const details = requestDetails(requests, tr);
  const label = tr ? "Onaylıyorum" : "I approve";
  const hint =
    (hasSharing
      ? tr
        ? "Kabul ettiğinizde listelenen paylaşımlar açılır ve gönderenin kişi listesine onaylı olarak eklenirsiniz."
        : "Accepting activates the listed shares and adds you as a confirmed person in the sender's people list."
      : tr
        ? "Bu istek kişi listesine eklenmeniz içindir."
        : "This request is to add you to the sender's people list.") +
    (tr
      ? " Bağlantı 7 gün geçerlidir. İsteği beklemiyorsanız e-postayı yok sayabilirsiniz."
      : " The link expires in 7 days. You can ignore this email if you did not expect this request.");
  return brandedMessage({
    from,
    to,
    locale: tr ? "tr" : "en",
    subject: hasSharing
      ? tr
        ? "Monline — Paylaşım daveti"
        : "Monline — Sharing invitation"
      : tr
        ? "Monline — Kişi listesine ekleme isteği"
        : "Monline — People list invitation",
    text: body + details.text + "\n\n" + label + ": " + url + "\n\n" + hint,
    bodyHtml:
      '<p style="margin:0 0 20px">' +
      escapeHtml(body) +
      "</p>" +
      details.html +
      '<p><a href="' +
      escapeHtml(url) +
      '" style="display:inline-block;padding:12px 20px;border:1px solid #b0ce62;border-radius:10px;background:#d1ff68;color:#303529;text-decoration:none;font-weight:600">' +
      label +
      '</a></p><p style="margin:20px 0 0;font-size:13px">' +
      escapeHtml(hint) +
      "</p>",
  });
}

async function deliverInvitation(repository, person, invitation) {
  if (!invitation) return;
  const settings = repository.settings();
  const sender = repository.findRecordById("users", person.getString("user"));
  const recipient = linkedAccount(repository, person);
  let deliveryStatus = "sent";
  try {
    await repository.newMailClient().send(
      invitationMessage({
        from: {
          address: settings.meta.senderAddress || "noreply@monline.app",
          name: settings.meta.senderName || "Monline",
        },
        to: [{ address: personEmail(repository, person) }],
        senderName: sender.getString("name")
          ? sender.getString("name") + " (" + sender.getString("email") + ")"
          : sender.getString("email"),
        language:
          recipient?.getString("language") || sender.getString("language"),
        url: invitation.url,
        requests: consent.pendingRequests(repository, person),
      }),
    );
  } catch {
    deliveryStatus = "failed";
    console.warn("[Monline] People invitation email could not be delivered");
  }
  // A concurrent resend, deletion or approval must never be overwritten.
  try {
    const latest = repository.findRecordById("household", person.id);
    const approval = latest.get("account_approval");
    if (approval?.token_hash !== invitation.tokenHash || approval.approved_at)
      return;
    latest.set("account_approval", {
      ...approval,
      delivery_status: deliveryStatus,
    });
    repository.save(latest);
    person.set("account_approval", latest.get("account_approval"));
  } catch (error) {
    if (!(error instanceof NotFoundError)) throw error;
  }
}

function registerPeopleInvitationsApi(app, repository, auth) {
  const resendLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 15,
    standardHeaders: "draft-8",
    legacyHeaders: false,
  });
  app.post("/api/data/household", resendLimit);
  app.patch("/api/data/household/:id", (req, res, next) =>
    Object.hasOwn(req.body || {}, "account_email")
      ? resendLimit(req, res, next)
      : next(),
  );
  app.post("/api/people/:id/resend", resendLimit, async (req, res) => {
    auth.requireUser(req);
    const person = repository.findRecordById("household", req.params.id);
    if (person.getString("user") !== req.user.id) throw new NotFoundError();
    if (isPersonConfirmed(repository, person))
      throw new BadRequestError("people_already_confirmed");
    const prior = person.get("account_approval");
    if (prior?.sent_at && Date.now() - Date.parse(prior.sent_at) < 60_000)
      throw new BadRequestError("people_invitation_wait");
    const invitation = prepareInvitation(
      repository,
      person,
      personEmail(repository, person),
      { force: true },
    );
    repository.save(person);
    await deliverInvitation(repository, person, invitation);
    res.json({ invitation_status: invitationState(repository, person) });
  });

  const confirmLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 60,
    standardHeaders: "draft-8",
    legacyHeaders: false,
  });
  function findInvitation(token) {
    if (typeof token !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(token))
      return null;
    const digest = hash(token);
    const row =
      repository.connection
        .prepare(
          "SELECT id FROM household WHERE json_extract(account_approval,'$.token_hash')=? LIMIT 1",
        )
        .get(digest) ||
      repository.connection
        .prepare(
          "SELECT id FROM household WHERE EXISTS (SELECT 1 FROM json_each(json_extract(household.account_approval,'$.previous_tokens')) WHERE json_extract(value,'$.hash')=? AND json_extract(value,'$.expires_at')>?) LIMIT 1",
        )
        .get(digest, Date.now());
    if (!row) return null;
    const person = repository.findRecordById("household", row.id);
    const approval = person.get("account_approval");
    if (
      !approval ||
      !Number.isFinite(approval.expires_at) ||
      approval.expires_at <= Date.now() ||
      !isValidEmail(approval.email) ||
      approval.owner_id !== person.getString("user")
    )
      return null;
    if (approval.approved_at && !isPersonConfirmed(repository, person))
      return null;
    const owner = repository.findRecordById("users", person.getString("user"));
    const account = linkedAccount(repository, person);
    if (
      owner.getBool("disabled") ||
      (approval.account_id &&
        (!account ||
          account.id !== approval.account_id ||
          account.getBool("disabled") ||
          normalizeEmail(account.getString("email")) !== approval.email))
    )
      return null;
    return { person, owner, approval };
  }
  function page(
    res,
    {
      status = 200,
      title,
      body,
      token = "",
      language = "en",
      requests,
      scope = "",
    },
  ) {
    const tr = language.toLowerCase().startsWith("tr");
    res
      .status(status)
      .set({
        "Cache-Control": "no-store",
        "Referrer-Policy": "strict-origin",
        "Content-Security-Policy":
          "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
      })
      .type("html")
      .send(
        '<!doctype html><html lang="' +
          (tr ? "tr" : "en") +
          '"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Monline</title></head><body style="margin:0;background:#f5f4ef;color:#303529;font:16px/1.6 system-ui,sans-serif"><main style="max-width:480px;margin:12vh auto;padding:28px;border:1px solid #c9cbc1;border-radius:20px;background:#fff"><strong>Monline</strong><h1 style="font-size:24px">' +
          escapeHtml(title) +
          "</h1><p>" +
          escapeHtml(body) +
          "</p>" +
          requestDetails(requests, tr).html +
          (token
            ? '<form method="post" action="confirm"><input type="hidden" name="token" value="' +
              escapeHtml(token) +
              '"><input type="hidden" name="scope" value="' +
              escapeHtml(scope) +
              '"><button type="submit" style="cursor:pointer;border:1px solid #b0ce62;border-radius:10px;background:#d1ff68;color:#303529;padding:12px 20px;font:inherit;font-weight:600">' +
              (tr ? "Onaylıyorum" : "I approve") +
              "</button></form>"
            : "") +
          "</main></body></html>",
      );
  }
  function invalid(req, res) {
    const language = req.acceptsLanguages("tr", "en") || "en";
    const tr = language === "tr";
    page(res, {
      status: 410,
      language,
      title: tr ? "Bağlantı geçerli değil" : "Link unavailable",
      body: tr
        ? "Bu davet kullanılmış, iptal edilmiş veya süresi dolmuş olabilir. Yeni bir davet isteyin."
        : "This invitation may have been used, cancelled or expired. Please request a new invitation.",
    });
  }
  function languageFor(invitation) {
    const recipient = linkedAccount(repository, invitation.person);
    return (
      recipient?.getString("language") ||
      invitation.owner.getString("language") ||
      "en"
    );
  }
  function accepted(res, invitation) {
    const language = languageFor(invitation),
      tr = language.toLowerCase().startsWith("tr");
    page(res, {
      language,
      title: tr ? "Onayınız kaydedildi" : "Approval saved",
      body: tr
        ? "Bu isteği onayladınız. Kabul edilen paylaşımları Monline’da görebilirsiniz. Bu pencereyi kapatabilirsiniz."
        : "You approved this request. Accepted shares are available in Monline. You can close this window.",
    });
  }
  function review(res, invitation, token, changed = false) {
    const language = languageFor(invitation);
    const tr = language.toLowerCase().startsWith("tr");
    const name = invitation.owner.getString("name")
      ? invitation.owner.getString("name") +
        " (" +
        invitation.owner.getString("email") +
        ")"
      : invitation.owner.getString("email");
    const { requests, digest } = consent.requestScope(
      repository,
      invitation.person,
    );
    const hasSharing = requests.subscriptions.length || requests.groups.length;
    page(res, {
      status: changed ? 409 : 200,
      title: hasSharing
        ? tr
          ? "Paylaşım daveti"
          : "Sharing invitation"
        : tr
          ? "Kişi listesine ekleme isteği"
          : "People list invitation",
      body: changed
        ? tr
          ? "İstek görüntülediğinizden beri değişti. Güncel listeyi ve yetkileri inceleyip tekrar onaylayın."
          : "This request changed since you opened it. Review the updated list and permissions before approving."
        : hasSharing
          ? tr
            ? name +
              " aşağıdaki paylaşımları açmak ve sizi kişi listesine eklemek istiyor. Kabul ettiğinizde onaylı kişi olarak eklenecek ve listelenen paylaşımlara erişebileceksiniz."
            : name +
              " wants to activate the shares below and add you to their people list. Accepting confirms you as a person and grants the listed access."
          : tr
            ? name +
              " sizi kişi listesine eklemek istiyor. Onaylıyor musunuz? Bu işlem aboneliklere erişim vermez."
            : name +
              " wants to add you to their people list. Do you approve? This does not grant subscription access.",
      token,
      language,
      requests,
      scope: digest,
    });
  }
  app.get("/api/people/confirm", confirmLimit, (req, res) => {
    const invitation = findInvitation(req.query.token);
    if (!invitation) return invalid(req, res);
    if (invitation.approval.approved_at) return accepted(res, invitation);
    review(res, invitation, req.query.token);
  });
  app.post("/api/people/confirm", confirmLimit, (req, res) => {
    const invitation = findInvitation(req.body?.token);
    if (!invitation) return invalid(req, res);
    if (invitation.approval.approved_at) return accepted(res, invitation);
    if (
      req.body?.scope !==
      consent.requestScope(repository, invitation.person).digest
    )
      return review(res, invitation, req.body.token, true);
    const { person, approval } = invitation;
    const recipientRow = repository.connection
      .prepare("SELECT id FROM users WHERE email=? COLLATE NOCASE")
      .get(approval.email);
    const recipient = recipientRow
      ? repository.findRecordById("users", recipientRow.id)
      : null;
    if (recipient?.getBool("disabled")) return invalid(req, res);
    repository.runInTransaction(() => {
      person.set("account", recipient?.id || "");
      person.set("account_approval", {
        ...approval,
        account_id: recipient?.id || "",
        approved_at: new Date().toISOString(),
      });
      repository.save(person);
      consent.activateRequests(repository, person);
    });
    accepted(res, invitation);
  });
}

module.exports = {
  isPersonConfirmed,
  personEmail,
  invitationState,
  prepareInvitation,
  deliverInvitation,
  invitationMessage,
  registerPeopleInvitationsApi,
};
