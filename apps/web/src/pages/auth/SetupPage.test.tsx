import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { setupService } from "@/services/setup";

import { SetupPage } from "./SetupPage";

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  t: (key: string) => key,
  i18n: { resolvedLanguage: "en", changeLanguage: vi.fn() },
}));
vi.mock("@tanstack/react-query", () => ({ useQuery: () => ({ data: { hasUsers: false } }) }));
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => mocks.navigate, Link: () => null }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: mocks.t, i18n: mocks.i18n }) }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: null, isLoading: false }) }));
vi.mock("@/routes", () => ({ setupRoute: { useSearch: () => ({}) } }));
vi.mock("./SetupStart", () => ({
  SetupStart: ({ onNew }: { onNew: () => void }) => (
    <button onClick={onNew}>New installation</button>
  ),
}));
vi.mock("@/services/setup", () => ({ setupService: { testSmtp: vi.fn() } }));

async function openSmtpStep() {
  const user = userEvent.setup();
  render(<SetupPage />);
  await user.click(screen.getByRole("button", { name: "New installation" }));
  await user.type(screen.getByLabelText("username"), "Admin");
  await user.type(screen.getByLabelText("email"), "admin@example.test");
  await user.type(screen.getByLabelText("password", { exact: true }), "test-password-2026");
  await user.type(screen.getByLabelText("confirm_password"), "test-password-2026");
  await user.click(screen.getByRole("button", { name: "next" }));
  await screen.findByLabelText("server_url");
  await user.click(screen.getByRole("button", { name: "next" }));
  await screen.findByText("setup_smtp_optional");
  return user;
}
async function enableSmtp(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("switch"));
  await user.type(screen.getByLabelText("smtp_address"), "smtp.example.test");
}
describe("setup SMTP test button", () => {
  afterEach(() => vi.unstubAllGlobals());
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.i18n.resolvedLanguage = "en";
    Element.prototype.hasPointerCapture = () => false;
    Element.prototype.setPointerCapture = () => {};
    Element.prototype.releasePointerCapture = () => {};
    Element.prototype.scrollIntoView = () => {};
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
  });

  it("identifies the initial account as administrator in the account step and setup review", async () => {
    const user = userEvent.setup();
    const firstVisit = render(<SetupPage />);
    await user.click(screen.getByRole("button", { name: "New installation" }));
    expect(screen.getByRole("heading", { name: "setup_account" })).toBeInTheDocument();
    expect(screen.getByText("setup_account_description")).toBeInTheDocument();
    firstVisit.unmount();
    const setupUser = await openSmtpStep();
    await setupUser.click(screen.getByRole("button", { name: "next" }));
    const accountType = screen.getByText("account_type");
    expect(accountType.nextElementSibling).toHaveTextContent("setup_account");
  });

  it("is hidden when SMTP is disabled and validates before sending", async () => {
    const user = await openSmtpStep();
    expect(screen.queryByRole("button", { name: "send_test_email" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("switch"));
    await user.click(screen.getByRole("button", { name: "send_test_email" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("required");
    expect(setupService.testSmtp).not.toHaveBeenCalled();
  });

  it("sends form values without finishing setup and clears success when settings change", async () => {
    const user = await openSmtpStep();
    await enableSmtp(user);
    vi.mocked(setupService.testSmtp).mockResolvedValue({ message: "setup_smtp_test_success" });
    await user.click(screen.getByRole("button", { name: "send_test_email" }));
    expect(await screen.findByRole("status")).toHaveTextContent("setup_smtp_test_success");
    expect(setupService.testSmtp).toHaveBeenCalledWith({
      email: "admin@example.test",
      language: "en",
      smtp: {
        enabled: true,
        host: "smtp.example.test",
        port: 587,
        username: "",
        password: "",
        senderName: "Monline",
        senderAddress: "admin@example.test",
        tls: true,
      },
    });
    expect(mocks.navigate).not.toHaveBeenCalled();
    await user.type(screen.getByLabelText("smtp_address"), "2");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("prevents duplicate sending and displays a recoverable authentication error", async () => {
    const user = await openSmtpStep();
    await enableSmtp(user);
    let rejectTest!: (error: Error) => void;
    vi.mocked(setupService.testSmtp).mockImplementation(
      () =>
        new Promise((_, reject) => {
          rejectTest = reject;
        }),
    );
    await user.click(screen.getByRole("button", { name: "send_test_email" }));
    expect(await screen.findByRole("button", { name: "sending" })).toBeDisabled();
    expect(screen.getByLabelText("smtp_address")).toBeDisabled();
    rejectTest(new Error("setup_smtp_test_auth_failed"));
    expect(await screen.findByRole("alert")).toHaveTextContent("setup_smtp_test_auth_failed");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "send_test_email" })).toBeEnabled(),
    );
    expect(screen.getByRole("button", { name: "next" })).toBeEnabled();
  });
  it.each(["tr", "bg"])(
    "includes the selected installation language %s in the SMTP test",
    async (language) => {
      mocks.i18n.resolvedLanguage = language;
      const user = await openSmtpStep();
      await enableSmtp(user);
      vi.mocked(setupService.testSmtp).mockResolvedValue({ message: "setup_smtp_test_success" });
      await user.click(screen.getByRole("button", { name: "send_test_email" }));
      await waitFor(() =>
        expect(setupService.testSmtp).toHaveBeenCalledWith(expect.objectContaining({ language })),
      );
    },
  );

  it("uses one language picker and carries changes into SMTP tests and the setup review", async () => {
    const user = userEvent.setup();
    const view = render(<SetupPage />);
    await user.click(screen.getByRole("button", { name: "New installation" }));
    await user.type(screen.getByLabelText("username"), "Admin");
    await user.type(screen.getByLabelText("email"), "admin@example.test");
    await user.type(screen.getByLabelText("password", { exact: true }), "test-password-2026");
    await user.type(screen.getByLabelText("confirm_password"), "test-password-2026");
    await user.click(screen.getByRole("button", { name: "next" }));
    await screen.findByLabelText("server_url");

    expect(screen.getAllByRole("combobox", { name: "language" })).toHaveLength(1);
    await user.click(screen.getByRole("combobox", { name: "language" }));
    await user.click(screen.getByRole("option", { name: "Türkçe" }));
    expect(mocks.i18n.changeLanguage).toHaveBeenCalledWith("tr");
    mocks.i18n.resolvedLanguage = "tr";
    view.rerender(<SetupPage />);

    await user.click(screen.getByRole("button", { name: "next" }));
    await enableSmtp(user);
    vi.mocked(setupService.testSmtp).mockResolvedValue({ message: "setup_smtp_test_success" });
    await user.click(screen.getByRole("button", { name: "send_test_email" }));
    await waitFor(() =>
      expect(setupService.testSmtp).toHaveBeenCalledWith(
        expect.objectContaining({ language: "tr" }),
      ),
    );
    await screen.findByRole("status");
    await user.click(screen.getByRole("button", { name: "next" }));
    expect(screen.getByText("language", { selector: "dt" }).nextElementSibling).toHaveTextContent(
      "Türkçe",
    );
  });
});
