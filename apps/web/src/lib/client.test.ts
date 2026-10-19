import type { User } from "@/types";

const key = "monline_session";
const user = { id: "user-1" } as User;

beforeEach(() => {
  vi.resetModules();
  localStorage.clear();
  sessionStorage.clear();
});

it("keeps unchecked sessions in session storage and survives page reloads", async () => {
  const { default: client } = await import("./client");
  client.authStore.save("temporary", user);
  expect(localStorage.getItem(key)).toBeNull();
  expect(JSON.parse(sessionStorage.getItem(key)!)).toMatchObject({
    token: "temporary",
    remember: false,
  });
  vi.resetModules();
  expect((await import("./client")).default.authStore.token).toBe("temporary");
  sessionStorage.clear();
  vi.resetModules();
  expect((await import("./client")).default.authStore.isValid).toBe(false);
});

it("restores remembered sessions after session storage is cleared", async () => {
  const { default: client } = await import("./client");
  client.authStore.save("persistent", user, true);
  expect(sessionStorage.getItem(key)).toBeNull();
  expect(JSON.parse(localStorage.getItem(key)!)).toMatchObject({
    token: "persistent",
    remember: true,
  });
  sessionStorage.clear();
  vi.resetModules();
  expect((await import("./client")).default.authStore.token).toBe("persistent");
});

it("clears previous persistence when signing in unchecked and clears both stores on logout", async () => {
  const { default: client } = await import("./client");
  client.authStore.save("old", user, true);
  client.authStore.save("new", user, false);
  expect(localStorage.getItem(key)).toBeNull();
  expect(JSON.parse(sessionStorage.getItem(key)!)).toMatchObject({ token: "new" });
  client.authStore.clear();
  expect(localStorage.getItem(key)).toBeNull();
  expect(sessionStorage.getItem(key)).toBeNull();
});

it("does not replace a session-only login with another tab's remembered login", async () => {
  const { default: client } = await import("./client");
  client.authStore.save("private-tab", user, false);
  window.dispatchEvent(
    new StorageEvent("storage", {
      key,
      storageArea: localStorage,
      newValue: JSON.stringify({ token: "another-tab", record: user, remember: true }),
    }),
  );
  expect(client.authStore.token).toBe("private-tab");
});
