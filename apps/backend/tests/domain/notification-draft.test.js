const runtime = require("../../src/runtime.cjs");
const send = vi.fn();
const findRecordsByFilter = vi.fn();
let handler;
let dispatchToAllProviders;
const saved = {
  telegram_bot_token: "saved-token",
  telegram_chat_id: "saved-chat",
};

beforeAll(() => {
  const original = {
    repository: runtime.repository,
    routerAdd: runtime.routerAdd,
    httpClient: runtime.httpClient,
  };
  Object.assign(runtime, {
    repository: {
      findRecordsByFilter,
      connection: {
        prepare: () => ({ get: () => ({ value: JSON.stringify(saved) }) }),
      },
      settings: () => ({ smtp: { enabled: false } }),
      findRecordById: () => ({ getString: () => "owner@example.test" }),
    },
    httpClient: { send },
    routerAdd: (method, route, callback) => {
      handler = callback;
    },
  });
  try {
    delete require.cache[
      require.resolve("../../src/domain/routes_notifications.js")
    ];
    delete require.cache[
      require.resolve("../../src/domain/lib/notifications.js")
    ];
    require("../../src/domain/routes_notifications.js");
    ({
      dispatchToAllProviders,
    } = require("../../src/domain/lib/notifications.js"));
  } finally {
    Object.assign(runtime, original);
  }
});
beforeEach(() => {
  send.mockReset().mockResolvedValue({});
  findRecordsByFilter
    .mockReset()
    .mockReturnValue([{ getString: (key) => saved[key] || "" }]);
});
async function testNotification(body, auth = { id: "owner-1" }) {
  const json = vi.fn();
  await handler({ auth, requestInfo: () => ({ body }), json });
  return json.mock.lastCall;
}

it("sends draft Telegram credentials without loading or saving a config", async () => {
  findRecordsByFilter.mockReturnValue([]);
  expect(
    await testNotification({
      provider: "telegram",
      config: {
        telegram_bot_token: "draft-token",
        telegram_chat_id: "draft-chat",
      },
    }),
  ).toEqual([200, { success: true }]);
  expect(send).toHaveBeenCalledWith(
    expect.objectContaining({
      url: "https://api.telegram.org/botdraft-token/sendMessage",
      body: expect.stringContaining('"chat_id":"draft-chat"'),
    }),
  );
  expect(findRecordsByFilter).not.toHaveBeenCalled();
});
it.each([
  {},
  { telegram_bot_token: "", telegram_chat_id: "draft-chat" },
  { telegram_bot_token: "draft-token" },
])(
  "never fills missing draft values from saved secrets: %j",
  async (config) => {
    expect((await testNotification({ provider: "telegram", config }))[0]).toBe(
      400,
    );
    expect(send).not.toHaveBeenCalled();
    expect(findRecordsByFilter).not.toHaveBeenCalled();
  },
);
it("uses the shared saved configuration when no draft is supplied", async () => {
  expect((await testNotification({ provider: "telegram" }))[0]).toBe(200);
  expect(findRecordsByFilter).not.toHaveBeenCalled();
  expect(send.mock.lastCall[0].url).toBe(
    "https://api.telegram.org/botsaved-token/sendMessage",
  );
});
it.each([
  null,
  [],
  "bad",
  { telegram_bot_token: 42 },
  { user: "another-owner" },
  { ntfy_password: "unrelated" },
  { telegram_bot_token: "x".repeat(8193) },
])("rejects invalid or unrelated draft fields", async (config) => {
  expect((await testNotification({ provider: "telegram", config }))[0]).toBe(
    400,
  );
  expect(send).not.toHaveBeenCalled();
});
it("requires authentication before reading draft credentials", async () => {
  expect(
    (await testNotification({ provider: "ntfy", config: {} }, null))[0],
  ).toBe(401);
  expect(send).not.toHaveBeenCalled();
});
it.each(["unknown", "toString", "__proto__"])(
  "rejects unknown provider %s",
  async (provider) => {
    expect((await testNotification({ provider, config: {} }))[0]).toBe(400);
    expect(send).not.toHaveBeenCalled();
  },
);

it.each([
  [
    { ntfy_username: "çağlar", ntfy_password: "test:şifre" },
    "Basic " + Buffer.from("çağlar:test:şifre").toString("base64"),
  ],
  [
    {
      ntfy_auth_token: "tk_test",
      ntfy_username: "demo",
      ntfy_password: "password",
    },
    "Bearer tk_test",
  ],
  [{}, undefined],
])(
  "uses the same ntfy authentication for tests and scheduled reminders",
  async (credentials, authorization) => {
    const config = {
      ntfy_url: "https://ntfy.example.test/base/",
      ntfy_topic: "private-topic",
      ...credentials,
    };
    expect((await testNotification({ provider: "ntfy", config }))[0]).toBe(200);
    const testRequest = send.mock.lastCall[0];
    expect(testRequest.url).toBe(
      "https://ntfy.example.test/base/private-topic",
    );
    expect(testRequest.headers.Authorization).toBe(authorization);
    // Unicode titles must be safe to construct as real Fetch headers.
    expect(() => new Headers(testRequest.headers)).not.toThrow();
    expect(
      Buffer.from(testRequest.headers.Title.slice(10, -2), "base64").toString(
        "utf8",
      ),
    ).toBe("🔔 Monline — Test Notification");
    await dispatchToAllProviders(
      {},
      {
        getBool: (key) => key === "ntfy_enabled",
        getString: (key) => config[key] || "",
      },
      "Upcoming payment",
      "Reminder",
      [],
    );
    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.lastCall[0]).toMatchObject({
      url: testRequest.url,
      headers: { Title: "Upcoming payment" },
      body: "Reminder",
    });
    expect(send.mock.lastCall[0].headers.Authorization).toBe(authorization);
  },
);
it.each([
  { ntfy_username: "demo" },
  { ntfy_password: "password" },
  { ntfy_username: "bad:name", ntfy_password: "password" },
])(
  "rejects incomplete or invalid basic authentication before sending",
  async (credentials) => {
    expect(
      (
        await testNotification({
          provider: "ntfy",
          config: { ntfy_topic: "topic", ...credentials },
        })
      )[0],
    ).toBe(400);
    expect(send).not.toHaveBeenCalled();
  },
);
