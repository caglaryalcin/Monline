import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { createQueryClientWrapper } from "@/test/query-client";

const { getConfig, createConfig, updateConfig, testNotif, getSmtp, saveSmtp } = vi.hoisted(() => ({
  getConfig: vi.fn(),
  createConfig: vi.fn(),
  updateConfig: vi.fn(),
  testNotif: vi.fn(),
  getSmtp: vi.fn(),
  saveSmtp: vi.fn(),
}));
const { toastSuccess, toastError } = vi.hoisted(() => ({
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));
let isAdmin = false;
let authUser: { id: string } | null = { id: "user-1" };
vi.mock("@/services/notifications", () => ({
  notificationsService: { getConfig, createConfig, updateConfig, test: testNotif },
}));
vi.mock("@/services/serverSettings", () => ({ serverSettingsService: { getSmtp } }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: authUser, isAdmin }) }));
vi.mock("@/lib/toast", () => ({ toast: { success: toastSuccess, error: toastError } }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@/components/settings/smtp/SMTPTab", async () => {
  const { forwardRef, useImperativeHandle } = await import("react");
  return {
    SMTPTab: forwardRef(
      ({ inline, channelEnabled }: { inline?: boolean; channelEnabled?: boolean }, ref) => {
        useImperativeHandle(ref, () => ({ save: saveSmtp }));
        return (
          <div data-testid="smtp-settings">
            {String(inline)}:{String(channelEnabled)}
          </div>
        );
      },
    ),
  };
});
vi.mock("@/components/settings/notifications/RemindersEditor", () => ({
  RemindersEditor: ({ reminders, onChange, onSave, isSaving, saveDisabled }: any) => (
    <section aria-label="reminders">
      <span data-testid="reminder-count">{reminders.length}</span>
      <button onClick={() => onChange([{ days: 2, hour: 9 }])}>change reminders</button>
      <button disabled={isSaving || saveDisabled} onClick={onSave}>
        save reminders
      </button>
    </section>
  ),
}));

import { NotificationsTab } from "./NotificationsTab";

const telegram = {
  telegram_enabled: true,
  telegram_bot_token: "old-token",
  telegram_chat_id: "old-chat",
};
function renderTab() {
  const { Wrapper } = createQueryClientWrapper();
  return render(<NotificationsTab />, { wrapper: Wrapper });
}
async function card(name: string) {
  const region = await screen.findByRole("region", { name });
  const header = within(region).getByRole("button", { name });
  if (header.getAttribute("aria-expanded") !== "true") await userEvent.click(header);
  return within(region);
}
beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  isAdmin = false;
  authUser = { id: "user-1" };
  getConfig.mockResolvedValue(null);
  getSmtp.mockResolvedValue({ enabled: true });
  createConfig.mockImplementation(async (data) => ({ ...data, id: "cfg-new" }));
  updateConfig.mockImplementation(async (id, data) => ({ ...data, id }));
  testNotif.mockResolvedValue({ success: true });
  saveSmtp.mockResolvedValue({ enabled: true, host: "smtp.example.test", hasPassword: true });
});

it("shows loading placeholders while settings are being loaded", () => {
  getConfig.mockImplementation(() => new Promise(() => {}));
  expect(renderTab().container.querySelector(".animate-pulse")).toBeInTheDocument();
});
it("places one Save button in every expanded provider instead of a page-level Save", async () => {
  renderTab();
  const email = await card("email (SMTP)");
  expect(email.getByRole("button", { name: "save" })).toBeInTheDocument();
  const ntfy = await card("ntfy.sh");
  expect(ntfy.getByRole("button", { name: "save" })).toBeInTheDocument();
  expect(screen.getAllByRole("button", { name: "save" })).toHaveLength(2);
  expect(screen.queryByTestId("smtp-settings")).not.toBeInTheDocument();
});
it("saves only the selected channel and preserves other channels' unsaved drafts", async () => {
  getConfig.mockResolvedValue({
    id: "cfg-1",
    user: "user-1",
    ...telegram,
    ntfy_enabled: true,
    ntfy_topic: "old-topic",
    reminders: [{ days: 7, hour: 10 }],
  });
  renderTab();
  const tg = await card("Telegram");
  const ntfy = await card("ntfy.sh");
  await userEvent.clear(tg.getByLabelText("bot_token"));
  await userEvent.type(tg.getByLabelText("bot_token"), "draft-token");
  await userEvent.clear(ntfy.getByLabelText("topic"));
  await userEvent.type(ntfy.getByLabelText("topic"), "unsaved-topic");
  await userEvent.click(tg.getByRole("button", { name: "save" }));
  await waitFor(() =>
    expect(updateConfig).toHaveBeenCalledExactlyOnceWith("cfg-1", {
      telegram_enabled: true,
      telegram_bot_token: "draft-token",
      telegram_chat_id: "old-chat",
    }),
  );
  expect(ntfy.getByLabelText("topic")).toHaveValue("unsaved-topic");
  expect(screen.getByTestId("reminder-count")).toHaveTextContent("1");
  expect(toastSuccess).toHaveBeenCalled();
});
it("reuses the first config record when another provider is saved", async () => {
  renderTab();
  const tg = await card("Telegram");
  await userEvent.click(tg.getByRole("switch"));
  await userEvent.type(tg.getByLabelText("bot_token"), "new-token");
  await userEvent.click(tg.getByRole("button", { name: "save" }));
  await waitFor(() =>
    expect(createConfig).toHaveBeenCalledExactlyOnceWith({
      user: "user-1",
      telegram_enabled: true,
      telegram_bot_token: "new-token",
      telegram_chat_id: "",
    }),
  );
  await waitFor(() => expect(tg.getByRole("button", { name: "save" })).toBeEnabled());
  const ntfy = await card("ntfy.sh");
  await userEvent.click(ntfy.getByRole("button", { name: "save" }));
  await waitFor(() =>
    expect(updateConfig).toHaveBeenCalledWith(
      "cfg-new",
      expect.objectContaining({ ntfy_enabled: false }),
    ),
  );
  expect(createConfig).toHaveBeenCalledOnce();
});
it("saves disabling a channel from that channel's visible Save button", async () => {
  getConfig.mockResolvedValue({ id: "cfg-1", ...telegram });
  renderTab();
  const tg = await card("Telegram");
  await userEvent.click(tg.getByRole("switch"));
  expect(tg.getByRole("button", { name: "Telegram" })).toHaveAttribute("aria-expanded", "true");
  expect(tg.getByRole("button", { name: "test_notification" })).toBeDisabled();
  await userEvent.click(tg.getByRole("button", { name: "save" }));
  await waitFor(() =>
    expect(updateConfig).toHaveBeenCalledWith("cfg-1", { ...telegram, telegram_enabled: false }),
  );
});
it("saves the reminder schedule in its own section without saving channel drafts", async () => {
  getConfig.mockResolvedValue({ id: "cfg-1", ...telegram, reminders: [{ days: 3, hour: 8 }] });
  renderTab();
  await screen.findByRole("region", { name: "reminders" });
  await userEvent.click(screen.getByRole("button", { name: "change reminders" }));
  await userEvent.click(screen.getByRole("button", { name: "save reminders" }));
  await waitFor(() =>
    expect(updateConfig).toHaveBeenCalledExactlyOnceWith("cfg-1", {
      reminders: [{ days: 2, hour: 9 }],
    }),
  );
});
it("uses one email-card Save for both admin SMTP settings and personal email settings", async () => {
  isAdmin = true;
  getConfig.mockResolvedValue({ id: "cfg-1", email_enabled: true, email_to: "old@example.test" });
  renderTab();
  const email = await card("email (SMTP)");
  expect(email.getAllByRole("button", { name: "save" })).toHaveLength(1);
  await userEvent.clear(email.getByLabelText("destination_email"));
  await userEvent.type(email.getByLabelText("destination_email"), "draft@example.test");
  await userEvent.click(email.getByRole("button", { name: "save" }));
  await waitFor(() =>
    expect(updateConfig).toHaveBeenCalledWith("cfg-1", {
      email_enabled: true,
      email_to: "draft@example.test",
    }),
  );
  expect(saveSmtp).toHaveBeenCalledOnce();
});
it("keeps the SMTP switch as a draft until the email card is saved", async () => {
  isAdmin = true;
  getSmtp.mockResolvedValue({ enabled: false });
  renderTab();
  const email = await card("email (SMTP)");
  await userEvent.click(email.getByRole("switch"));
  expect(screen.getByTestId("smtp-settings")).toHaveTextContent("true:true");
  expect(saveSmtp).not.toHaveBeenCalled();
  expect(createConfig).not.toHaveBeenCalled();
  await userEvent.click(email.getByRole("button", { name: "save" }));
  await waitFor(() =>
    expect(createConfig).toHaveBeenCalledWith({
      user: "user-1",
      email_enabled: true,
      email_to: "",
    }),
  );
  expect(saveSmtp).toHaveBeenCalledOnce();
});
it("does not save personal email settings if saving the SMTP server fails", async () => {
  isAdmin = true;
  getConfig.mockResolvedValue({ id: "cfg-1", email_enabled: true });
  saveSmtp.mockRejectedValue(new Error("SMTP save failed"));
  renderTab();
  const email = await card("email (SMTP)");
  await userEvent.click(email.getByRole("button", { name: "save" }));
  await waitFor(() => expect(toastError).toHaveBeenCalled());
  expect(updateConfig).not.toHaveBeenCalled();
});
it("does not access admin SMTP settings for regular users", async () => {
  renderTab();
  const email = await card("email (SMTP)");
  await userEvent.click(email.getByRole("button", { name: "save" }));
  await waitFor(() => expect(createConfig).toHaveBeenCalled());
  expect(getSmtp).not.toHaveBeenCalled();
  expect(saveSmtp).not.toHaveBeenCalled();
});
it("does not save notification credentials when testing unsaved form values", async () => {
  getConfig.mockResolvedValue({ id: "cfg-1", ...telegram, gotify_token: "unrelated-secret" });
  renderTab();
  const tg = await card("Telegram");
  await userEvent.clear(tg.getByLabelText("bot_token"));
  await userEvent.type(tg.getByLabelText("bot_token"), "draft-token");
  await userEvent.click(tg.getByRole("button", { name: "test_notification" }));
  await waitFor(() =>
    expect(testNotif).toHaveBeenCalledWith("telegram", {
      telegram_bot_token: "draft-token",
      telegram_chat_id: "old-chat",
    }),
  );
  expect(createConfig).not.toHaveBeenCalled();
  expect(updateConfig).not.toHaveBeenCalled();
});
it("prevents duplicate first saves and disables other card actions while saving", async () => {
  createConfig.mockImplementation(() => new Promise(() => {}));
  renderTab();
  const tg = await card("Telegram");
  const ntfy = await card("ntfy.sh");
  await userEvent.click(tg.getByRole("button", { name: "save" }));
  expect(tg.getByRole("button", { name: "saving" })).toBeDisabled();
  expect(ntfy.getByRole("button", { name: "save" })).toBeDisabled();
  expect(ntfy.getByRole("switch")).toBeDisabled();
  expect(createConfig).toHaveBeenCalledOnce();
});
it("retains channel drafts after a save failure", async () => {
  getConfig.mockResolvedValue({ id: "cfg-1", ...telegram });
  updateConfig.mockRejectedValue(new Error("save failed"));
  renderTab();
  const tg = await card("Telegram");
  await userEvent.clear(tg.getByLabelText("bot_token"));
  await userEvent.type(tg.getByLabelText("bot_token"), "draft-token");
  await userEvent.click(tg.getByRole("button", { name: "save" }));
  await waitFor(() => expect(toastError).toHaveBeenCalled());
  expect(tg.getByLabelText("bot_token")).toHaveValue("draft-token");
});
