const express = require("express");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { Repository, DataRecord } = require("../../src/storage.cjs");
const { registerSharingApi } = require("../../src/sharing.cjs");
const { registerDataApi } = require("../../src/data-api.cjs");
const { UnauthorizedError } = require("../../src/errors.cjs");
const {
  registerPeopleInvitationsApi,
} = require("../../src/people-invitations.cjs");
const runtime = require("../../src/runtime.cjs");

const owner = "aaaaaaaaaaaaaaa",
  viewer = "bbbbbbbbbbbbbbb",
  other = "ccccccccccccccc",
  outsider = "ddddddddddddddd";
let repository,
  directory,
  server,
  base,
  subscription,
  self,
  privatePerson,
  send;
function record(collection, data) {
  const result = new DataRecord(
    repository.findCollectionByNameOrId(collection),
  );
  for (const [key, value] of Object.entries(data)) result.set(key, value);
  repository.save(result);
  return result;
}
function confirmedContact(accountId) {
  const account = repository.findRecordById("users", accountId);
  return record("household", {
    user: owner,
    name: account.getString("name"),
    account: accountId,
    account_approval: {
      owner_id: owner,
      account_id: accountId,
      email: account.getString("email"),
      approved_at: new Date().toISOString(),
    },
  });
}
function invitationUrl(email) {
  const message = send.mock.calls
    .map(([message]) => message)
    .findLast((message) => message.to[0].address === email);
  const url = message?.text.match(
    /https?:\/\/[^\s]+\/api\/people\/confirm\?token=[A-Za-z0-9_-]+/,
  )?.[0];
  if (!url) throw new Error("Missing invitation URL");
  return new URL(url);
}
async function reviewInvitation(url) {
  const response = await fetch(base + url.pathname + url.search);
  const html = await response.text();
  return {
    response,
    html,
    scope: html.match(/name="scope" value="([^"]+)"/)?.[1],
  };
}
async function approveInvitation(url, scope) {
  return fetch(base + url.pathname, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: url.searchParams.get("token"), scope }),
  });
}
async function request(endpoint, user = owner, method = "GET", body) {
  const response = await fetch(base + endpoint, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(user ? { "X-Test-User": user } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return {
    status: response.status,
    data: response.status === 204 ? null : await response.json(),
  };
}
const sharingPath = () => `/api/sharing/subscriptions/${subscription.id}`;
const editingPath = () =>
  `/api/sharing/shared-subscriptions/${subscription.id}`;
const share = (emails, permissions = {}, groups = [], groupPermissions = {}) =>
  request(sharingPath(), owner, "PUT", {
    userEmails: emails,
    userPermissions: permissions,
    groupIds: groups,
    groupPermissions,
  });
beforeEach(async () => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), "monline-sharing-"));
  repository = new Repository(directory);
  [owner, viewer, other, outsider].forEach((id, index) =>
    repository.connection
      .prepare(
        "INSERT INTO users (id,email,name,language,created) VALUES (?,?,?,?,?)",
      )
      .run(
        id,
        `user${index}@example.test`,
        ["Owner", "Recipient", "Other", "Outsider"][index],
        "tr",
        `2026-01-0${index + 1}`,
      ),
  );
  const currency = record("currencies", {
    user: owner,
    code: "TRY",
    name: "Turkish lira",
    symbol: "₺",
    rate: 1,
    is_main: true,
  });
  const cycle = record("cycles", { name: "Monthly" });
  self = record("household", {
    user: owner,
    name: "Owner",
    account: owner,
    is_main: true,
  });
  privatePerson = record("household", {
    user: owner,
    name: "Unrelated private person",
  });
  subscription = record("subscriptions", {
    user: owner,
    name: "HBO",
    currency: currency.id,
    cycle: cycle.id,
    frequency: 1,
    price: 300,
    next_payment: "2026-11-28",
    payer: self.id,
  });
  const settings = repository.settings();
  settings.smtp.enabled = true;
  settings.meta.senderAddress = "sender@example.test";
  repository.save(settings);
  record("admin_settings", { server_url: "https://monline.example.test" });
  send = vi.fn().mockResolvedValue({});
  repository.newMailClient = () => ({ send });
  const auth = {
    requireUser(req) {
      if (!req.user) throw new UnauthorizedError();
    },
    isAdmin: (user) => user?.id === owner,
  };
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    req.user = req.get("X-Test-User")
      ? repository.findRecordById("users", req.get("X-Test-User"))
      : null;
    next();
  });
  runtime.configure(app, repository, auth);
  registerPeopleInvitationsApi(app, repository, auth);
  registerSharingApi(app, repository, auth);
  registerDataApi(app, repository, auth);
  app.use((error, req, res, next) =>
    res.status(error.status || 500).json({ error: error.message }),
  );
  server = await new Promise((resolve) => {
    const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
  });
  base = `http://127.0.0.1:${server.address().port}`;
});
afterEach(async () => {
  vi.restoreAllMocks();
  if (server) await new Promise((resolve) => server.close(resolve));
  repository?.connection.close();
  const resolved = path.resolve(directory);
  if (
    !resolved.startsWith(
      path.resolve(os.tmpdir()) + path.sep + "monline-sharing-",
    )
  )
    throw new Error("Unexpected fixture directory");
  fs.rmSync(resolved, { recursive: true, force: true });
});

it("persists direct read/edit permissions, enforces them on the server and preserves legacy read access", async () => {
  confirmedContact(viewer);
  expect((await share(["user1@example.test"])).status).toBe(200);
  expect(
    (await request(editingPath(), viewer, "PATCH", { name: "Changed" })).status,
  ).toBe(403);
  const upgraded = await share(["user1@example.test"], {
    "user1@example.test": "edit",
  });
  expect(upgraded.data.userPermissions).toEqual({
    "user1@example.test": "edit",
  });
  expect(
    (await request("/api/sharing/shared-subscriptions", viewer)).data[0]
      .permission,
  ).toBe("edit");
  expect(
    (await request(editingPath(), viewer, "PATCH", { name: "Edited HBO" }))
      .status,
  ).toBe(200);
  expect(
    (await request(editingPath(), viewer, "PATCH", { user: viewer })).status,
  ).toBe(400);
  expect(
    (
      await request(editingPath(), viewer, "PATCH", {
        url: "https://example.test",
      })
    ).status,
  ).toBe(400);
  expect(
    (await request(editingPath(), outsider, "PATCH", { name: "Intrusion" }))
      .status,
  ).toBe(404);
  await share(["user1@example.test"], { "user1@example.test": "read" });
  expect(
    (await request(editingPath(), viewer, "PATCH", { price: 1 })).status,
  ).toBe(403);
  expect(
    (await share(["user1@example.test"], { "user3@example.test": "edit" }))
      .status,
  ).toBe(400);
  expect(
    (await share(["user1@example.test"], { "user1@example.test": "owner" }))
      .status,
  ).toBe(400);
});

it("emails only newly granted recipients and deduplicates direct/group overlaps and permission-only changes", async () => {
  [viewer, other, outsider].forEach(confirmedContact);
  const group = await request("/api/sharing/groups", owner, "POST", {
    name: "Family",
    memberEmails: ["user1@example.test", "user2@example.test"],
  });
  await share(["user1@example.test"], {}, [group.data.id], {
    [group.data.id]: "read",
  });
  expect(send).toHaveBeenCalledTimes(2);
  expect(
    new Set(send.mock.calls.map(([message]) => message.to[0].address)),
  ).toEqual(new Set(["user1@example.test", "user2@example.test"]));
  const message = send.mock.calls[0][0];
  expect(message.text).toContain(
    "Owner adlı kullanıcı sizinle “HBO” aboneliğini paylaştı.",
  );
  expect(message.text).toContain(
    "https://monline.example.test/subscriptions#shared-subscriptions-title",
  );
  expect(message).not.toHaveProperty("cc");
  expect(message.to).toHaveLength(1);
  await share(
    ["user1@example.test"],
    { "user1@example.test": "edit" },
    [group.data.id],
    { [group.data.id]: "edit" },
  );
  expect(send).toHaveBeenCalledTimes(2);
  await request(`/api/sharing/groups/${group.data.id}`, owner, "PUT", {
    name: "Family",
    memberEmails: [
      "user1@example.test",
      "user2@example.test",
      "user3@example.test",
    ],
  });
  expect(send).toHaveBeenCalledTimes(3);
  expect(send.mock.lastCall[0].to).toEqual([{ address: "user3@example.test" }]);
  // A direct edit grant remains effective even if the group's permission is read.
  await share(
    ["user1@example.test"],
    { "user1@example.test": "edit" },
    [group.data.id],
    { [group.data.id]: "read" },
  );
  expect(
    (await request("/api/sharing/shared-subscriptions", viewer)).data[0]
      .permission,
  ).toBe("edit");
});

it("isolates payer choices to confirmed people and preserves historical payment payers", async () => {
  const recipientPerson = confirmedContact(viewer);
  const otherPerson = confirmedContact(other);
  await share(["user1@example.test", "user2@example.test"], {
    "user1@example.test": "edit",
  });
  const options = await request(sharingPath() + "/payers", viewer);
  expect(options.status).toBe(200);
  expect(options.data.map((option) => option.name)).toEqual(
    expect.arrayContaining(["Owner", "Recipient", "Other"]),
  );
  expect(JSON.stringify(options.data)).not.toContain("@example.test");
  expect(options.data.some((option) => option.value === privatePerson.id)).toBe(
    false,
  );
  expect((await request(sharingPath() + "/payers", other)).status).toBe(403);
  expect((await request(sharingPath() + "/payers", outsider)).status).toBe(404);
  const payment = record("payment_records", {
    user: owner,
    subscription_id: subscription.id,
    due_date: "2026-10-28",
    paid_at: "2026-10-28T09:00:00Z",
    amount: 300,
    payer: self.id,
  });
  const saved = await request(editingPath(), viewer, "PATCH", {
    payer: recipientPerson.id,
  });
  expect(saved.status).toBe(200);
  const current = repository.findRecordById("subscriptions", subscription.id);
  const person = repository.findRecordById(
    "household",
    current.getString("payer"),
  );
  expect(person.getString("user")).toBe(owner);
  expect(person.getString("account")).toBe(viewer);
  expect(
    repository.findRecordById("payment_records", payment.id).getString("payer"),
  ).toBe(self.id);
  expect(
    (await request("/api/sharing/shared-subscriptions", viewer)).data[0].expand
      .payer,
  ).toMatchObject({ name: "Recipient", user: owner });
  expect(
    (await request(editingPath(), viewer, "PATCH", { payer: privatePerson.id }))
      .status,
  ).toBe(400);
  expect(
    (
      await request(editingPath(), viewer, "PATCH", {
        payer: `account:${outsider}`,
      })
    ).status,
  ).toBe(400);
  expect(
    (
      await request(
        `/api/data/subscriptions/${subscription.id}`,
        owner,
        "PATCH",
        { payer: otherPerson.id },
      )
    ).status,
  ).toBe(200);
  const second = repository.findRecordById(
    "household",
    repository
      .findRecordById("subscriptions", subscription.id)
      .getString("payer"),
  );
  expect(second.getString("account")).toBe(other);
});

it("preserves payer and contact records when an edit is rejected", async () => {
  const recipientPerson = confirmedContact(viewer);
  await share(["user1@example.test"], { "user1@example.test": "edit" });
  const count = repository.countRecords("household");
  expect(
    (
      await request(editingPath(), viewer, "PATCH", {
        payer: recipientPerson.id,
        name: "",
      })
    ).status,
  ).toBe(400);
  expect(repository.countRecords("household")).toBe(count);
  expect(
    repository
      .findRecordById("subscriptions", subscription.id)
      .getString("payer"),
  ).toBe(self.id);
});

it("preserves sharing on mail failure and sends nothing when SMTP is disabled", async () => {
  [viewer, other].forEach(confirmedContact);
  vi.spyOn(console, "warn").mockImplementation(() => {});
  send.mockRejectedValueOnce(new Error("SMTP unavailable"));
  expect((await share(["user1@example.test"])).status).toBe(200);
  expect(
    (await request("/api/sharing/shared-subscriptions", viewer)).data,
  ).toHaveLength(1);
  const settings = repository.settings();
  settings.smtp.enabled = false;
  repository.save(settings);
  expect(
    (await share(["user1@example.test", "user2@example.test"])).status,
  ).toBe(200);
  expect(send).toHaveBeenCalledTimes(1);
});

it("escapes subscription names in HTML while retaining readable plain text", async () => {
  subscription.set("name", "<img src=x onerror=alert(1)>");
  repository.save(subscription);
  await share(["user1@example.test"]);
  const message = send.mock.lastCall[0];
  expect(message.html).toContain("&lt;img src=x onerror=alert(1)&gt;");
  expect(message.html).not.toContain("<img src=x");
  expect(message.text).toContain("<img src=x onerror=alert(1)>");
});

it("requires explicit email approval before direct access and confirms the person atomically", async () => {
  const saved = await share(["user1@example.test"], {
    "user1@example.test": "edit",
  });
  expect(saved.status).toBe(200);
  expect(saved.data.users[0].status).toBe("pending");
  expect(
    (await request("/api/sharing/shared-subscriptions", viewer)).data,
  ).toEqual([]);
  expect(
    (await request(editingPath(), viewer, "PATCH", { name: "Intrusion" }))
      .status,
  ).toBe(404);
  const url = invitationUrl("user1@example.test");
  expect(url.origin).toBe("https://monline.example.test");
  const review = await reviewInvitation(url);
  expect(review.response.status).toBe(200);
  expect(review.html).toContain("HBO");
  expect(review.response.headers.get("referrer-policy")).toBe("strict-origin");
  // Following the mail link (including by a scanner) never approves a request.
  expect(
    (await request("/api/sharing/shared-subscriptions", viewer)).data,
  ).toEqual([]);
  expect((await approveInvitation(url, "wrong-scope")).status).toBe(409);
  expect((await approveInvitation(url, review.scope)).status).toBe(200);
  const contacts = (await request("/api/data/household")).data.items;
  expect(contacts.find((person) => person.account_id === viewer)).toMatchObject(
    { account_confirmed: true },
  );
  expect(
    (await request("/api/sharing/shared-subscriptions", viewer)).data[0]
      .permission,
  ).toBe("edit");
  expect(
    (await request(editingPath(), viewer, "PATCH", { name: "Approved edit" }))
      .status,
  ).toBe(200);
  expect((await approveInvitation(url, review.scope)).status).toBe(200);
  expect((await reviewInvitation(url)).html).not.toContain("<form");
  expect(send).toHaveBeenCalledTimes(1);
});

it("activates group invitations on approval and removes subscription access when the group is detached", async () => {
  const result = await request("/api/sharing/groups", owner, "POST", {
    name: "Family",
    memberEmails: ["user1@example.test"],
  });
  expect(result.status).toBe(201);
  expect(result.data.members).toEqual([]);
  expect(result.data.pendingMembers).toHaveLength(1);
  await share([], {}, [result.data.id], { [result.data.id]: "read" });
  const url = invitationUrl("user1@example.test");
  const review = await reviewInvitation(url);
  expect(review.html).toContain("Family");
  expect(review.html).toContain("HBO");
  expect((await approveInvitation(url, review.scope)).status).toBe(200);
  expect(
    (await request("/api/sharing/shared-subscriptions", viewer)).data,
  ).toHaveLength(1);
  expect((await request("/api/sharing/groups")).data[0].members).toHaveLength(
    1,
  );
  await share([]);
  expect((await request(sharingPath())).data).toMatchObject({
    groups: [],
    users: [],
  });
  expect(
    (await request("/api/sharing/shared-subscriptions", viewer)).data,
  ).toEqual([]);
  // Removing the association retains the reusable group and approved contact.
  expect((await request("/api/sharing/groups")).data).toHaveLength(1);
  expect(
    (await request("/api/data/household")).data.items.find(
      (person) => person.account_id === viewer,
    ).account_confirmed,
  ).toBe(true);
});

it("revokes direct and group access on deleting a confirmed person", async () => {
  const person = confirmedContact(viewer);
  const group = await request("/api/sharing/groups", owner, "POST", {
    name: "Family",
    memberEmails: ["user1@example.test"],
  });
  await share(
    ["user1@example.test"],
    { "user1@example.test": "edit" },
    [group.data.id],
    { [group.data.id]: "edit" },
  );
  expect(
    (await request("/api/sharing/shared-subscriptions", viewer)).data,
  ).toHaveLength(1);
  expect(
    (await request(`/api/data/household/${person.id}`, owner, "DELETE")).status,
  ).toBe(204);
  expect(
    (await request("/api/sharing/shared-subscriptions", viewer)).data,
  ).toEqual([]);
  expect((await request(sharingPath())).data.users).toEqual([]);
  expect((await request("/api/sharing/groups")).data[0].members).toEqual([]);
});

it("rejects deleting the owner's own person even when another person is the default", async () => {
  self.set("is_main", false);
  repository.save(self);
  const result = await request(
    `/api/data/household/${self.id}`,
    owner,
    "DELETE",
  );
  expect(result.status).toBe(403);
  expect(result.data.error).toBe("cannot_delete_yourself");
  expect(
    repository.findRecordById("household", self.id).getString("account"),
  ).toBe(owner);
});

it("preserves sharing records while disabled and independently controls attached groups", async () => {
  confirmedContact(viewer);
  const group = await request("/api/sharing/groups", owner, "POST", {
    name: "Family",
    memberEmails: ["user1@example.test"],
  });
  await share([], {}, [group.data.id], { [group.data.id]: "edit" });
  expect(
    (
      await request(sharingPath() + "/enabled", viewer, "PATCH", {
        enabled: false,
      })
    ).status,
  ).toBe(404);
  const disabled = await request(sharingPath() + "/enabled", owner, "PATCH", {
    enabled: false,
  });
  expect(disabled.data.groups).toEqual([group.data.id]);
  expect(
    (await request("/api/sharing/shared-subscriptions", viewer)).data,
  ).toEqual([]);
  await request(sharingPath() + "/enabled", owner, "PATCH", { enabled: true });
  expect(
    (await request("/api/sharing/shared-subscriptions", viewer)).data[0]
      .permission,
  ).toBe("edit");
  await request(sharingPath(), owner, "PUT", {
    userEmails: [],
    groupIds: [group.data.id],
    groupPermissions: { [group.data.id]: "edit" },
    groupEnabled: { [group.data.id]: false },
  });
  expect((await request(sharingPath())).data.groups).toEqual([group.data.id]);
  expect(
    (await request("/api/sharing/shared-subscriptions", viewer)).data,
  ).toEqual([]);
  expect(
    (
      await request(sharingPath() + "/enabled", owner, "PATCH", {
        enabled: "false",
      })
    ).status,
  ).toBe(400);
});

it("refreshes a changed invitation scope and keeps earlier mail links usable", async () => {
  await share(["user1@example.test"]);
  const url = invitationUrl("user1@example.test");
  const before = await reviewInvitation(url);
  await share(["user1@example.test"], { "user1@example.test": "edit" });
  const changed = await approveInvitation(url, before.scope);
  expect(changed.status).toBe(409);
  const html = await changed.text();
  expect(html).toContain("HBO");
  const scope = html.match(/name="scope" value="([^"]+)"/)[1];
  expect((await approveInvitation(url, scope)).status).toBe(200);
  expect(
    (await request("/api/sharing/shared-subscriptions", viewer)).data[0]
      .permission,
  ).toBe("edit");
});

it("does not let generic contact writes forge approval and invalidates deleted invitations", async () => {
  const result = await request("/api/data/household", owner, "POST", {
    name: "Recipient",
    account_email: "user1@example.test",
    account: viewer,
    account_approval: {
      owner_id: owner,
      account_id: viewer,
      email: "user1@example.test",
      approved_at: new Date().toISOString(),
    },
  });
  expect(result.status).toBe(201);
  expect(result.data.account_confirmed).toBe(false);
  expect(result.data).not.toHaveProperty("account_approval");
  const url = invitationUrl("user1@example.test");
  const review = await reviewInvitation(url);
  await request(`/api/data/household/${result.data.id}`, owner, "DELETE");
  expect((await approveInvitation(url, review.scope)).status).toBe(410);
});

it("keeps unapproved shares pending on mail failure and requires SMTP for new invitations", async () => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  send.mockRejectedValueOnce(new Error("SMTP unavailable"));
  const result = await share(["user1@example.test"]);
  expect(result.status).toBe(200);
  expect(result.data.invitation_delivery_failures).toBe(1);
  expect(
    (await request("/api/sharing/shared-subscriptions", viewer)).data,
  ).toEqual([]);
  const settings = repository.settings();
  settings.smtp.enabled = false;
  repository.save(settings);
  expect((await share(["user2@example.test"])).status).toBe(400);
  expect((await request(sharingPath())).data.users[0].email).toBe(
    "user1@example.test",
  );
});
