import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { createQueryClientWrapper } from "@/test/query-client";

import { NotificationsTab } from "./NotificationsTab";

const { getConfig, createConfig, updateConfig, getSmtp } = vi.hoisted(() => ({
  getConfig: vi.fn(),
  createConfig: vi.fn(),
  updateConfig: vi.fn(),
  getSmtp: vi.fn(),
}));
vi.mock("@/services/notifications", () => ({
  notificationsService: { getConfig, createConfig, updateConfig },
}));
vi.mock("@/services/serverSettings", () => ({ serverSettingsService: { getSmtp } }));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "user-1" }, isAdmin: false }),
}));
vi.mock("@/lib/toast", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
function renderTab() {
  const { Wrapper } = createQueryClientWrapper();
  return render(<NotificationsTab />, { wrapper: Wrapper });
}
beforeEach(() => {
  vi.clearAllMocks();
  getConfig.mockResolvedValue({
    id: "",
    user: "user-1",
    email_enabled: false,
    telegram_enabled: false,
    available_channels: { email: true, telegram: true },
  });
  createConfig.mockImplementation(async (data) => ({
    ...data,
    id: "saved",
    available_channels: { email: true, telegram: true },
  }));
  updateConfig.mockImplementation(async (id, data) => ({
    ...data,
    id,
    available_channels: { email: true, telegram: true },
  }));
});
it("shows loading status and disables switches until availability is known", () => {
  getConfig.mockImplementation(() => new Promise(() => {}));
  renderTab();
  expect(screen.getByRole("status")).toHaveTextContent("loading");
  expect(screen.getByRole("switch", { name: "Telegram" })).toBeDisabled();
});
it("exposes personal switches without credentials, recipients or admin SMTP requests", async () => {
  renderTab();
  await waitFor(() => expect(screen.getByRole("switch", { name: "Telegram" })).toBeEnabled());
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "save" })).not.toBeInTheDocument();
  expect(getSmtp).not.toHaveBeenCalled();
});
it("creates only the current user's channel preference then reuses that record", async () => {
  renderTab();
  const telegram = screen.getByRole("switch", { name: "Telegram" });
  await waitFor(() => expect(telegram).toBeEnabled());
  await userEvent.click(telegram);
  await waitFor(() =>
    expect(createConfig).toHaveBeenCalledExactlyOnceWith({
      user: "user-1",
      telegram_enabled: true,
    }),
  );
  await waitFor(() => expect(telegram).toBeEnabled());
  await userEvent.click(telegram);
  await waitFor(() =>
    expect(updateConfig).toHaveBeenCalledWith("saved", { telegram_enabled: false }),
  );
});
it("allows disabling a stale preference when the global channel is unavailable", async () => {
  getConfig.mockResolvedValue({
    id: "cfg-1",
    telegram_enabled: true,
    available_channels: { telegram: false },
  });
  renderTab();
  const telegram = screen.getByRole("switch", { name: "Telegram" });
  await waitFor(() => expect(telegram).toBeChecked());
  expect(telegram).toBeEnabled();
  await userEvent.click(telegram);
  await waitFor(() =>
    expect(updateConfig).toHaveBeenCalledWith("cfg-1", { telegram_enabled: false }),
  );
});
it("prevents enabling a channel that the administrator has not configured", async () => {
  getConfig.mockResolvedValue({
    id: "cfg-1",
    telegram_enabled: false,
    available_channels: { telegram: false },
  });
  renderTab();
  await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument());
  expect(screen.getByRole("switch", { name: "Telegram" })).toBeDisabled();
});
it("keeps switches disabled when configuration cannot be loaded", async () => {
  getConfig.mockRejectedValue(new Error("offline"));
  renderTab();
  expect(await screen.findByRole("alert")).toHaveTextContent("admin_config_load_error");
  expect(screen.getByRole("switch", { name: "Telegram" })).toBeDisabled();
  expect(createConfig).not.toHaveBeenCalled();
});
