const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const express = require("express");
const { Repository, DataRecord } = require("../../src/storage.cjs");
const { createAuth } = require("../../src/auth.cjs");
const { registerDataApi } = require("../../src/data-api.cjs");

it("keeps sorting through reload, logout and a fresh login without changing another account", async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "monline-sort-auth-"));
  const repository = new Repository(directory);
  let server;
  try {
    const makeUser = (email) => {
      const user = new DataRecord(repository.findCollectionByNameOrId("users"));
      user.set("email", email);
      user.set("name", email);
      user.setPassword("sort-regression-password");
      user.set("verified", true);
      user.set("sort_order", "name");
      user.set("sort_direction", "asc");
      return repository.save(user);
    };
    const first = makeUser("first@example.test");
    const second = makeUser("second@example.test");
    const auth = createAuth(repository);
    const app = express();
    app.use(express.json());
    app.use(auth.middleware);
    auth.register(app);
    registerDataApi(app, repository, auth);
    app.use((error, req, res, next) => res.status(error.status || 500).json({ message: error.message }));
    server = await new Promise((resolve) => {
      const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
    });
    const base = `http://127.0.0.1:${server.address().port}`;
    const request = async (endpoint, token, method = "GET", body) => {
      const response = await fetch(base + endpoint, {
        method,
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const data = response.status === 204 ? null : await response.json();
      expect(response.ok, JSON.stringify(data)).toBe(true);
      return data;
    };
    const login = (email) => request("/api/auth/login", null, "POST", {
      identity: email, password: "sort-regression-password", remember: false,
    });
    let session = await login("first@example.test");
    for (const key of ["next_payment", "price", "status", "name"]) {
      const preferences = { sort_order: key, sort_direction: "desc" };
      const saved = await request(`/api/data/users/${first.id}`, session.token, "PATCH", preferences);
      expect(saved).toMatchObject(preferences);
      const reloaded = await request("/api/auth/refresh", session.token, "POST");
      expect(reloaded.record).toMatchObject(preferences);
      await request("/api/auth/logout", session.token, "POST");
      expect(auth.resolve(session.token)).toBeNull();
      session = await login("first@example.test");
      expect(session.record).toMatchObject(preferences);
    }
    const otherSession = await login("second@example.test");
    expect(otherSession.record).toMatchObject({ id: second.id, sort_order: "name", sort_direction: "asc" });
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    repository.connection.close();
    const resolved = path.resolve(directory);
    if (!resolved.startsWith(path.resolve(os.tmpdir()) + path.sep + "monline-sort-auth-"))
      throw new Error("Unexpected sort authentication fixture directory");
    fs.rmSync(resolved, { recursive: true, force: true });
  }
});
