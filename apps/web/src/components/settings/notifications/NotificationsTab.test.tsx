import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { createQueryClientWrapper } from "@/test/query-client";

import { NotificationsTab } from "./NotificationsTab";
const mocks = vi.hoisted(() => ({ getPersonalConfig: vi.fn(), savePersonalConfig: vi.fn(),
  user: { id: "first", language: "en" } }));
vi.mock("@/services/notifications", () => ({ notificationsService: {
  getPersonalConfig: mocks.getPersonalConfig, savePersonalConfig: mocks.savePersonalConfig,
} }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: mocks.user, isAdmin: false }) }));
vi.mock("@/lib/toast", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
const config = (owner: string) => ({ id: "config-" + owner, user: owner,
  telegram_enabled: false, reminders: [{ days: owner === "first" ? 3 : 5, hour: 8 }],
  available_channels: { telegram: true, email: false },
});
beforeEach(() => {
  vi.clearAllMocks(); mocks.user = { id: "first", language: "en" };
  mocks.getPersonalConfig.mockImplementation(async () => config(mocks.user.id));
  mocks.savePersonalConfig.mockImplementation(async body => ({ ...config(mocks.user.id), ...body }));
});
function show() { const { Wrapper } = createQueryClientWrapper(); return render(<NotificationsTab />, { wrapper: Wrapper }); }
it("shows loading and error states", async () => {
  mocks.getPersonalConfig.mockImplementation(() => new Promise(() => {}));
  const view = show(); expect(screen.getByRole("status")).toHaveTextContent("loading"); view.unmount();
  mocks.getPersonalConfig.mockRejectedValue(new Error("offline")); show();
  expect(await screen.findByRole("alert")).toHaveTextContent("admin_config_load_error");
});
it("offers personal switches without credential, SMTP or template forms", async () => {
  show(); const toggle = await screen.findByRole("switch", { name: "Telegram" });
  expect(toggle).toBeEnabled(); expect(screen.getByRole("switch", { name: "Email" })).toBeDisabled();
  expect(screen.queryByLabelText("bot_token")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("smtp_host")).not.toBeInTheDocument();
  await userEvent.click(toggle);
  await waitFor(() => expect(mocks.savePersonalConfig).toHaveBeenCalledWith({ telegram_enabled: true }, expect.anything()));
});
it("saves the account reminder schedule separately", async () => {
  show(); await screen.findByRole("switch", { name: "Telegram" });
  await userEvent.click(screen.getByRole("button", { name: "add_reminder" }));
  await userEvent.click(screen.getByRole("button", { name: "save" }));
  await waitFor(() => expect(mocks.savePersonalConfig).toHaveBeenCalledWith({
    reminders: [{ days: 3, hour: 8 }, { days: 1, hour: 8 }],
  }, expect.anything()));
});
it("loads the next account's reminder schedule instead of retaining a draft", async () => {
  const view = show(); await screen.findByRole("switch", { name: "Telegram" });
  await userEvent.click(screen.getByRole("button", { name: "add_reminder" })); view.unmount();
  mocks.user = { id: "second", language: "en" }; show();
  await screen.findByRole("switch", { name: "Telegram" });
  expect(screen.getAllByRole("combobox")).toHaveLength(2);
  expect(screen.getAllByRole("combobox")[0]).toHaveTextContent("5 days_before_n");
});
