const runtime = require("../../src/runtime.cjs");
const { smtpTestMessage } = require("../../src/email-templates.cjs");

const routes = new Map();
const send = vi.fn().mockResolvedValue(undefined);
let language = "tr";
const user = {
  id: "user-1",
  get: (key) => (key === "email" ? "account@example.test" : language),
  getString: (key) => (key === "language" ? language : ""),
};
const repository = {
  settings: () => ({
    meta: { senderAddress: "monline@example.test", senderName: "Monline" },
  }),
  findRecordsByFilter: (collection) =>
    collection === "users"
      ? [user]
      : [{ getString: () => "notifications@example.test" }],
  findRecordById: () => user,
  newMailClient: () => ({ send }),
};

beforeAll(() => {
  const original = {
    repository: runtime.repository,
    routerAdd: runtime.routerAdd,
  };
  Object.assign(runtime, {
    repository,
    routerAdd: (method, route, handler) => routes.set(route, handler),
  });
  try {
    for (const modulePath of [
      "../../src/domain/routes_notifications.js",
      "../../src/domain/routes_admin.js",
    ]) {
      delete require.cache[require.resolve(modulePath)];
      require(modulePath);
    }
  } finally {
    Object.assign(runtime, original);
  }
});

beforeEach(() => send.mockClear());
it.each(["tr", "en", "de"])(
  "uses the setup template for both settings email tests in %s",
  async (selectedLanguage) => {
    language = selectedLanguage;
    for (const route of ["/api/notifications/test", "/api/admin/smtp/test"]) {
      const json = vi.fn();
      await routes.get(route)({
        auth: user,
        requestInfo: () => ({ body: { provider: "email" } }),
        json,
      });
      expect(json).toHaveBeenCalledWith(200, expect.any(Object));
      const message = send.mock.lastCall[0];
      const expected = smtpTestMessage({
        language,
        from: repository.settings().meta.senderAddress,
        to: [],
      });
      expect(message).toMatchObject({
        subject: expected.subject,
        text: expected.text,
        html: expected.html,
        attachments: expected.attachments,
      });
      expect(message.from).toEqual({
        address: "monline@example.test",
        name: "Monline",
      });
      expect(message.to).toEqual([
        {
          address: route.includes("notifications")
            ? "notifications@example.test"
            : "account@example.test",
        },
      ]);
    }
  },
);
it("rejects unauthenticated notification tests without sending an email", async () => {
  const json = vi.fn();
  await routes.get("/api/notifications/test")({ auth: null, json });
  expect(json).toHaveBeenCalledWith(401, expect.any(Object));
  expect(send).not.toHaveBeenCalled();
});
