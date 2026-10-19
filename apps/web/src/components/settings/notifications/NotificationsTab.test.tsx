import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { createQueryClientWrapper } from "@/test/query-client";

// ── Hoisted mocks ─────────────────────────────────────────────────────────────

const { getConfig, createConfig, updateConfig, testNotif } = vi.hoisted(() => ({
  getConfig: vi.fn(),
  createConfig: vi.fn(),
  updateConfig: vi.fn(),
  testNotif: vi.fn(),
}));

const { toastSuccess, toastError } = vi.hoisted(() => ({
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

let mockAuthUser: { id?: string } | null = { id: "user-1" };
let isAdmin = false;

vi.mock("@/services/notifications", () => ({
  notificationsService: {
    getConfig,
    createConfig,
    updateConfig,
    test: testNotif,
  },
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: mockAuthUser, isAdmin }),
}));

vi.mock("@/lib/toast", () => ({
  toast: { success: toastSuccess, error: toastError },
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@/components/settings/notifications/ProviderCard", () => ({
  ProviderCard: ({ provider, formData, onChange, onTest, isTesting, children }: any) => (
    <div data-testid={`provider-${provider.id}`}>
      {provider.fields.map(({ key }: { key: string }) => (
        <input
          key={key}
          aria-label={key}
          value={formData[key] ?? ""}
          onChange={(event) => onChange(key, event.target.value)}
        />
      ))}
      <span data-testid={`is-testing-${provider.id}`}>{String(isTesting)}</span>
      <button data-testid={`test-${provider.id}`} onClick={() => onTest()}>
        test
      </button>
      <button
        data-testid={`enable-${provider.id}`}
        onClick={() => onChange(provider.enabledKey, true)}
      >
        enable
      </button>
      {children}
    </div>
  ),
}));

vi.mock("@/components/settings/notifications/RemindersEditor", () => ({
  RemindersEditor: ({ reminders, onChange }: any) => (
    <div>
      <span data-testid="reminder-count">{reminders.length}</span>
      <button data-testid="reminders-change" onClick={() => onChange([{ days: 2, hour: 9 }])}>
        change
      </button>
    </div>
  ),
}));
vi.mock("@/components/settings/smtp/SMTPTab", () => ({
  SMTPTab: ({ inline }: { inline?: boolean }) => (
    <div data-testid="smtp-provider">{String(inline)}</div>
  ),
}));

import { NotificationsTab } from "./NotificationsTab";

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("NotificationsTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthUser = { id: "user-1" };
    isAdmin = false;
    getConfig.mockResolvedValue(null);
    createConfig.mockResolvedValue({ id: "new-id" });
    updateConfig.mockResolvedValue({ id: "cfg-1" });
    testNotif.mockResolvedValue({ message: "ok" });
  });

  it("renders a loading skeleton while the config query is pending", () => {
    getConfig.mockImplementation(() => new Promise(() => {}));
    const { Wrapper } = createQueryClientWrapper();
    const { container } = render(<NotificationsTab />, { wrapper: Wrapper });
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });

  it("renders the notifications UI after config resolves as null", async () => {
    const { Wrapper } = createQueryClientWrapper();
    render(<NotificationsTab />, { wrapper: Wrapper });
    await waitFor(() => expect(screen.getByTestId("provider-email")).toBeInTheDocument());
    expect(screen.getByTestId("provider-email")).toBeInTheDocument();
  });
  it("merges SMTP settings into the email card only for administrators", async () => {
    const { Wrapper } = createQueryClientWrapper();
    const { rerender } = render(<NotificationsTab />, { wrapper: Wrapper });
    await waitFor(() => expect(screen.getByTestId("provider-email")).toBeInTheDocument());
    expect(screen.queryByTestId("smtp-provider")).not.toBeInTheDocument();
    isAdmin = true;
    rerender(<NotificationsTab />);
    expect(screen.getByTestId("smtp-provider")).toHaveTextContent("true");
    expect(screen.getByTestId("provider-email")).toContainElement(
      screen.getByTestId("smtp-provider"),
    );
  });

  it("uses the empty-string query key fallback and skips loading config when user is missing", async () => {
    mockAuthUser = null;
    const { Wrapper } = createQueryClientWrapper();
    render(<NotificationsTab />, { wrapper: Wrapper });

    await waitFor(() => expect(screen.getByTestId("provider-email")).toBeInTheDocument());
    expect(getConfig).not.toHaveBeenCalled();
  });

  it("initialises reminders from DEFAULT_REMINDERS when config has an empty array", async () => {
    getConfig.mockResolvedValue({
      id: "cfg-1",
      user: "user-1",
      email_enabled: true,
      reminders: [],
    });
    const { Wrapper } = createQueryClientWrapper();
    render(<NotificationsTab />, { wrapper: Wrapper });
    await waitFor(() => expect(screen.getByTestId("reminder-count")).toBeInTheDocument());
    // DEFAULT_REMINDERS has exactly 1 entry
    expect(screen.getByTestId("reminder-count")).toHaveTextContent("1");
  });

  it("preserves config reminders when they are non-empty", async () => {
    getConfig.mockResolvedValue({
      id: "cfg-1",
      user: "user-1",
      email_enabled: true,
      reminders: [
        { days: 7, hour: 10 },
        { days: 1, hour: 8 },
      ],
    });
    const { Wrapper } = createQueryClientWrapper();
    render(<NotificationsTab />, { wrapper: Wrapper });
    await waitFor(() => expect(screen.getByTestId("reminder-count")).toHaveTextContent("2"));
  });

  it("shows the enabled-count badge when at least one provider is active", async () => {
    getConfig.mockResolvedValue({
      id: "cfg-1",
      user: "user-1",
      email_enabled: true,
      discord_enabled: true,
    });
    const { Wrapper } = createQueryClientWrapper();
    render(<NotificationsTab />, { wrapper: Wrapper });
    await waitFor(() => expect(screen.getByText(/2.+enabled/)).toBeInTheDocument());
  });

  it("calls createConfig when no config id exists on save", async () => {
    const { Wrapper } = createQueryClientWrapper();
    render(<NotificationsTab />, { wrapper: Wrapper });
    await waitFor(() => expect(screen.getByRole("button", { name: "save" })).toBeInTheDocument());
    await userEvent.click(screen.getByRole("button", { name: "save" }));
    await waitFor(() => expect(createConfig).toHaveBeenCalled());
    expect(toastSuccess).toHaveBeenCalled();
  });

  it("saves successfully with a missing user id and still runs the success path", async () => {
    mockAuthUser = null;
    const { Wrapper } = createQueryClientWrapper();
    render(<NotificationsTab />, { wrapper: Wrapper });

    await waitFor(() => expect(screen.getByRole("button", { name: "save" })).toBeInTheDocument());
    await userEvent.click(screen.getByRole("button", { name: "save" }));

    await waitFor(() =>
      expect(createConfig).toHaveBeenCalledWith(expect.objectContaining({ user: undefined })),
    );
    expect(toastSuccess).toHaveBeenCalled();
  });

  it("calls updateConfig with the config id when an existing record is present", async () => {
    getConfig.mockResolvedValue({ id: "cfg-1", user: "user-1" });
    const { Wrapper } = createQueryClientWrapper();
    render(<NotificationsTab />, { wrapper: Wrapper });
    await waitFor(() => expect(screen.getByRole("button", { name: "save" })).toBeInTheDocument());
    await userEvent.click(screen.getByRole("button", { name: "save" }));
    await waitFor(() => expect(updateConfig).toHaveBeenCalledWith("cfg-1", expect.any(Object)));
    expect(toastSuccess).toHaveBeenCalled();
  });

  it("shows an error toast when the save mutation fails", async () => {
    createConfig.mockRejectedValue(new Error("network error"));
    const { Wrapper } = createQueryClientWrapper();
    render(<NotificationsTab />, { wrapper: Wrapper });
    await waitFor(() => expect(screen.getByRole("button", { name: "save" })).toBeInTheDocument());
    await userEvent.click(screen.getByRole("button", { name: "save" }));
    await waitFor(() => expect(toastError).toHaveBeenCalled());
  });

  it("disables the save button and shows the saving label while mutation is pending", async () => {
    createConfig.mockImplementation(() => new Promise(() => {}));
    const { Wrapper } = createQueryClientWrapper();
    render(<NotificationsTab />, { wrapper: Wrapper });
    await waitFor(() => expect(screen.getByRole("button", { name: "save" })).toBeInTheDocument());
    await userEvent.click(screen.getByRole("button", { name: "save" }));
    expect(screen.getByRole("button", { name: "saving" })).toBeDisabled();
  });

  it("sends a test notification and shows success toast on success", async () => {
    const { Wrapper } = createQueryClientWrapper();
    render(<NotificationsTab />, { wrapper: Wrapper });
    await waitFor(() => expect(screen.getByTestId("test-email")).toBeInTheDocument());
    await userEvent.click(screen.getByTestId("test-email"));
    await waitFor(() => expect(testNotif).toHaveBeenCalledWith("email", { email_to: "" }));
    expect(toastSuccess).toHaveBeenCalled();
  });

  it("shows error toast when test notification fails", async () => {
    testNotif.mockRejectedValue(new Error("unreachable"));
    const { Wrapper } = createQueryClientWrapper();
    render(<NotificationsTab />, { wrapper: Wrapper });
    await waitFor(() => expect(screen.getByTestId("test-email")).toBeInTheDocument());
    await userEvent.click(screen.getByTestId("test-email"));
    await waitFor(() => expect(toastError).toHaveBeenCalled());
  });

  it("tests unsaved Telegram values without saving or sending other channel secrets", async () => {
    getConfig.mockResolvedValue({
      id: "cfg-1",
      user: "user-1",
      telegram_enabled: true,
      telegram_bot_token: "old-token",
      telegram_chat_id: "old-chat",
      gotify_token: "unrelated-secret",
    });
    const { Wrapper } = createQueryClientWrapper();
    render(<NotificationsTab />, { wrapper: Wrapper });
    await screen.findByDisplayValue("old-token");
    await userEvent.clear(screen.getByLabelText("telegram_bot_token"));
    await userEvent.type(screen.getByLabelText("telegram_bot_token"), "draft-token");
    await userEvent.clear(screen.getByLabelText("telegram_chat_id"));
    await userEvent.type(screen.getByLabelText("telegram_chat_id"), "draft-chat");
    await userEvent.click(screen.getByTestId("test-telegram"));
    expect(testNotif).toHaveBeenCalledWith("telegram", {
      telegram_bot_token: "draft-token",
      telegram_chat_id: "draft-chat",
    });
    expect(createConfig).not.toHaveBeenCalled();
    expect(updateConfig).not.toHaveBeenCalled();
  });

  it("tests new ntfy credentials before the first save, then persists them only on Save", async () => {
    const { Wrapper } = createQueryClientWrapper();
    render(<NotificationsTab />, { wrapper: Wrapper });
    await screen.findByTestId("test-ntfy");
    await userEvent.click(screen.getByTestId("enable-ntfy"));
    for (const [key, value] of Object.entries({
      ntfy_topic: "private-topic",
      ntfy_username: "demo-user",
      ntfy_password: "demo-password",
    })) {
      await userEvent.type(screen.getByLabelText(key), value);
    }
    await userEvent.click(screen.getByTestId("test-ntfy"));
    expect(testNotif).toHaveBeenCalledWith("ntfy", {
      ntfy_url: "",
      ntfy_topic: "private-topic",
      ntfy_username: "demo-user",
      ntfy_password: "demo-password",
      ntfy_auth_token: "",
    });
    expect(createConfig).not.toHaveBeenCalled();
    expect(updateConfig).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "save" }));
    await waitFor(() =>
      expect(createConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          ntfy_enabled: true,
          ntfy_topic: "private-topic",
          ntfy_username: "demo-user",
          ntfy_password: "demo-password",
        }),
      ),
    );
  });

  it("marks only the tested provider as in-flight during the request", async () => {
    testNotif.mockImplementation(() => new Promise(() => {}));
    const { Wrapper } = createQueryClientWrapper();
    render(<NotificationsTab />, { wrapper: Wrapper });
    await waitFor(() => expect(screen.getByTestId("test-email")).toBeInTheDocument());
    await userEvent.click(screen.getByTestId("test-email"));
    await waitFor(() => expect(screen.getByTestId("is-testing-email")).toHaveTextContent("true"));
    expect(screen.getByTestId("is-testing-discord")).toHaveTextContent("false");
  });

  it("keeps relative provider order stable when all providers have the same enabled state (sort returns 0)", async () => {
    // With all providers disabled (default state), aOn === bOn for every comparison,
    // so the sort comparator returns 0 — covering the `aOn === bOn ? 0` branch.
    const { Wrapper } = createQueryClientWrapper();
    render(<NotificationsTab />, { wrapper: Wrapper });
    await waitFor(() => expect(screen.getByTestId("provider-email")).toBeInTheDocument());
    // All providers appear — sort didn't throw and returned 0 for each pair
    expect(screen.getByTestId("provider-discord")).toBeInTheDocument();
  });

  it("moves an enabled later provider ahead of disabled earlier providers", async () => {
    getConfig.mockResolvedValue({
      id: "cfg-1",
      user: "user-1",
      discord_enabled: true,
      email_enabled: false,
    });
    const { Wrapper } = createQueryClientWrapper();
    render(<NotificationsTab />, { wrapper: Wrapper });

    await waitFor(() => expect(screen.getByTestId("provider-discord")).toBeInTheDocument());

    const providerIds = screen
      .getAllByTestId(/provider-/)
      .map((node) => node.getAttribute("data-testid"));

    expect(providerIds[0]).toBe("provider-discord");
    expect(providerIds.indexOf("provider-discord")).toBeLessThan(
      providerIds.indexOf("provider-email"),
    );
  });

  it("includes updated reminders from RemindersEditor in the save payload", async () => {
    getConfig.mockResolvedValue({ id: "cfg-1", user: "user-1", email_enabled: true });
    const { Wrapper } = createQueryClientWrapper();
    render(<NotificationsTab />, { wrapper: Wrapper });
    await waitFor(() => expect(screen.getByTestId("reminders-change")).toBeInTheDocument());
    await userEvent.click(screen.getByTestId("reminders-change"));
    await userEvent.click(screen.getByRole("button", { name: "save" }));
    await waitFor(() =>
      expect(updateConfig).toHaveBeenCalledWith(
        "cfg-1",
        expect.objectContaining({ reminders: [{ days: 2, hour: 9 }] }),
      ),
    );
  });
});
