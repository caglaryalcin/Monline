import {
  getSettingsPageMenuItems,
  SETTINGS_TAB_COMPONENTS,
  type SettingsTabKey,
} from "./settingsPage.config";

describe("settingsPage.config", () => {
  const expectedKeys: SettingsTabKey[] = [
    "profile",
    "security",
    "2fa",
    "categories",
    "household",
    "groups",
    "currencies",
    "payment_methods",
    "display",
    "theme",
    "notifications",
    "api_key",
    "exchange_rates",
    "registration",
    "smtp",
    "oidc",
    "maintenance",
    "delete",
  ];

  it("SETTINGS_TAB_COMPONENTS has all expected keys", () => {
    for (const key of expectedKeys) {
      expect(SETTINGS_TAB_COMPONENTS[key]).toBeDefined();
    }
    expect(Object.keys(SETTINGS_TAB_COMPONENTS)).toHaveLength(expectedKeys.length);
  });

  it("returns the personal menu order while server sections are managed in administration", () => {
    const t = (k: string) => k;
    const items = getSettingsPageMenuItems(t as never, true);
    expect(items.map((item) => item.value)).toEqual([
      "profile",
      "security",
      "notifications",
      "household",
      "groups",
      "categories",
      "display",
      "payment_methods",
      "currencies",
      "delete",
    ]);
    expect(SETTINGS_TAB_COMPONENTS.smtp).toBe(SETTINGS_TAB_COMPONENTS.notifications);
    expect(SETTINGS_TAB_COMPONENTS.registration).toBe(SETTINGS_TAB_COMPONENTS.security);
  });

  it("keeps server-only menu entries hidden from regular users", () => {
    const items = getSettingsPageMenuItems(((key: string) => key) as never);
    expect(items.map((item) => item.value)).not.toContain("oidc");
    expect(items.map((item) => item.value)).not.toContain("maintenance");
    expect(items.map((item) => item.value)).toContain("security");
    expect(items.map((item) => item.value)).toContain("notifications");
  });

  it("delete tab is marked as danger", () => {
    const t = (k: string) => k;
    const items = getSettingsPageMenuItems(t as never, true);
    const deleteItem = items.find((i) => i.value === "delete");
    expect(deleteItem?.danger).toBe(true);
  });
});
