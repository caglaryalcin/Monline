const express = require("express");
const net = require("node:net");
const { registerSetupApi } = require("../../src/setup.cjs");
const { Repository } = require("../../src/storage.cjs");
const { smtpTestMessage } = require("../../src/email-templates.cjs");
const emailLocales = require("../../src/email-locales.json");

let server, base, repository, send;
const configuration = () => ({
  email: "admin@example.test",
  smtp: {
    enabled: true,
    host: "smtp.example.test",
    port: 587,
    username: "admin",
    password: "private-test-password",
    senderAddress: "monline@example.test",
    senderName: "Monline",
    tls: true,
  },
});
async function testSmtp(body = configuration()) {
  const response = await fetch(base + "/api/auth/setup/smtp-test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: response.status, data: await response.json() };
}
beforeEach(async () => {
  send = vi.fn().mockResolvedValue(undefined);
  repository = {
    countRecords: vi.fn().mockReturnValue(0),
    newMailClient: vi.fn().mockReturnValue({ send }),
    save: vi.fn(),
  };
  const app = express();
  app.use(express.json());
  registerSetupApi(app, repository, {});
  app.use((error, req, res, next) => {
    res
      .status(error.status || 500)
      .json({ message: error.message, data: error.data });
  });
  server = await new Promise((resolve) => {
    const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
  });
  base = `http://127.0.0.1:${server.address().port}`;
});
afterEach(async () => {
  vi.restoreAllMocks();
  await new Promise((resolve) => server.close(resolve));
});
it("tests unsaved SMTP settings and sends only to the supplied administrator email", async () => {
  const body = configuration();
  body.to = "ignored@example.test";
  const result = await testSmtp(body);
  expect(result.status).toBe(200);
  expect(repository.newMailClient).toHaveBeenCalledWith(
    expect.objectContaining({
      host: body.smtp.host,
      password: body.smtp.password,
      port: 587,
      tls: true,
    }),
  );
  expect(send).toHaveBeenCalledWith(
    expect.objectContaining({
      to: [{ address: body.email }],
      from: { address: body.smtp.senderAddress, name: "Monline" },
    }),
  );
  expect(repository.save).not.toHaveBeenCalled();
  const message = send.mock.calls[0][0];
  expect(message.html).toContain('src="cid:monline-logo"');
  expect(message.html).not.toMatch(/https?:\/\//);
  expect(message.attachments[0]).toMatchObject({
    contentType: "image/png",
    contentDisposition: "inline",
    cid: "monline-logo",
  });
  expect(message.attachments[0].content.subarray(0, 8).toString("hex")).toBe(
    "89504e470d0a1a0a",
  );
});
it("rejects tests once setup is complete or a restore is running", async () => {
  repository.countRecords.mockReturnValue(1);
  expect((await testSmtp()).data.message).toBe("setup_already_complete");
  repository.countRecords.mockReturnValue(0);
  repository.databaseOperation = "restore";
  expect((await testSmtp()).status).toBe(409);
  expect(send).not.toHaveBeenCalled();
});
it("uses the selected setup language for both subject and content", async () => {
  const body = { ...configuration(), language: "tr" };
  expect((await testSmtp(body)).status).toBe(200);
  const message = send.mock.calls[0][0];
  expect(message.subject).toBe("Monline — SMTP Testi");
  expect(message.text).toBe(emailLocales.tr.body);
  expect(message.html).toContain(emailLocales.tr.body);
  expect(message.html).toContain('<html lang="tr">');
});
it("rejects unsupported setup languages without sending", async () => {
  expect(
    (await testSmtp({ ...configuration(), language: "<script>" })).status,
  ).toBe(400);
  expect(send).not.toHaveBeenCalled();
});
it.each(Object.keys(emailLocales))(
  "renders the complete %s SMTP template",
  (language) => {
    const message = smtpTestMessage({
      from: "sender@example.test",
      to: "admin@example.test",
      language,
    });
    expect(message.subject).toBe(emailLocales[language].subject);
    expect(message.text).toBe(emailLocales[language].body);
    expect(message.html).toContain(emailLocales[language].body);
    expect(message.html).toContain(`alt="${emailLocales[language].logoAlt}"`);
    expect(message.html).toContain(
      `<html lang="${language.replace("_", "-")}">`,
    );
    expect(message.attachments[0].cid).toBe("monline-logo");
  },
);
it.each([
  ["tr-TR", "tr"],
  ["de-DE", "de"],
  ["pt-BR", "pt_BR"],
  ["zh-CN", "zh_CN"],
  ["unsupported", "en"],
  [null, "en"],
  ["__proto__", "en"],
])("normalizes %s or falls back safely", (language, expected) => {
  const message = smtpTestMessage({ language });
  expect(message.text).toBe(emailLocales[expected].body);
});
it.each([
  ["email", "bad\r\nBcc: injected@example.test"],
  ["host", "http://example.test"],
  ["port", 0],
  ["port", 65536],
  ["senderAddress", "invalid"],
  ["senderName", "name\r\nBcc: other@example.test"],
  ["enabled", false],
  ["tls", "yes"],
])("rejects invalid %s before connecting", async (field, value) => {
  const body = configuration();
  if (field === "email") body.email = value;
  else body.smtp[field] = value;
  expect((await testSmtp(body)).status).toBe(400);
  expect(send).not.toHaveBeenCalled();
});
it.each([
  ["EAUTH", "setup_smtp_test_auth_failed"],
  ["ETIMEDOUT", "setup_smtp_test_connection_failed"],
  ["EENVELOPE", "setup_smtp_test_failed"],
])(
  "returns a safe localized error for %s and permits retry",
  async (code, key) => {
    send.mockRejectedValueOnce(
      Object.assign(new Error("secret-password private-host"), { code }),
    );
    const result = await testSmtp();
    expect(result.status).toBe(502);
    expect(result.data.message).toBe(key);
    expect(JSON.stringify(result.data)).not.toContain("secret-password");
    expect((await testSmtp()).status).toBe(200);
  },
);
it("allows at most five attempts per minute across clients", async () => {
  let now = Date.now();
  vi.spyOn(Date, "now").mockImplementation(() => now);
  for (let i = 0; i < 5; i++) expect((await testSmtp()).status).toBe(200);
  expect((await testSmtp()).status).toBe(429);
  expect(send).toHaveBeenCalledTimes(5);
  now += 60_001;
  expect((await testSmtp()).status).toBe(200);
});
it("rejects a second request while a test is still sending", async () => {
  let release;
  send.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        release = resolve;
      }),
  );
  const pending = testSmtp();
  await vi.waitFor(() => expect(send).toHaveBeenCalledOnce());
  expect((await testSmtp()).status).toBe(429);
  release();
  expect((await pending).status).toBe(200);
});
it("uses the temporary transport against a local SMTP server without reading saved settings", async () => {
  const sockets = new Set();
  let content = "";
  const smtp = net.createServer((socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
    socket.setEncoding("utf8");
    socket.write("220 localhost SMTP test\r\n");
    let buffer = "",
      data = false;
    socket.on("data", (chunk) => {
      buffer += chunk;
      let newline;
      while ((newline = buffer.indexOf("\r\n")) >= 0) {
        const line = buffer.slice(0, newline);
        buffer = buffer.slice(newline + 2);
        if (data) {
          if (line === ".") {
            data = false;
            socket.write("250 accepted\r\n");
          } else content += line + "\n";
        } else if (line.startsWith("DATA")) {
          data = true;
          socket.write("354 send data\r\n");
        } else if (line.startsWith("QUIT")) socket.end("221 bye\r\n");
        else socket.write("250 localhost\r\n");
      }
    });
  });
  await new Promise((resolve) => smtp.listen(0, "127.0.0.1", resolve));
  try {
    const settings = vi.fn(() => {
      throw new Error("Saved settings must not be read");
    });
    await Repository.prototype.newMailClient
      .call(
        { settings },
        {
          enabled: true,
          host: "127.0.0.1",
          port: smtp.address().port,
          tls: false,
        },
      )
      .send(
        smtpTestMessage({
          from: "monline@example.test",
          to: "admin@example.test",
        }),
      );
    expect(content).toContain("To: admin@example.test");
    expect(content).toContain(
      "Your Monline SMTP configuration is working correctly.",
    );
    expect(content).toContain("Content-ID: <monline-logo>");
    expect(content).toContain("Content-Type: image/png");
    expect(content).toContain("multipart/related");
    expect(settings).not.toHaveBeenCalled();
  } finally {
    for (const socket of sockets) socket.destroy();
    await new Promise((resolve) => smtp.close(resolve));
  }
});
