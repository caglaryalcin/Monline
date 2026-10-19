import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { queryKeys } from "@/lib/queryKeys";
import { toast } from "@/lib/toast";
import { serverSettingsService } from "@/services/serverSettings";

import { SMTPTab, type SMTPTabHandle } from "./SMTPTab";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/lib/toast", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/services/serverSettings", () => ({
  serverSettingsService: {
    getSmtp: vi.fn(),
    updateSmtp: vi.fn(),
    testSmtp: vi.fn(),
  },
}));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
  },
});

describe("SMTPTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryClient.clear();
  });

  const renderComponent = (embedded = false) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <SMTPTab embedded={embedded} />
      </QueryClientProvider>,
    );
  };

  it("renders SMTP fields inside the email card without a second header or duplicate email test", async () => {
    vi.mocked(serverSettingsService.getSmtp).mockResolvedValue({
      enabled: true,
      host: "smtp.example.test",
    });
    vi.mocked(serverSettingsService.updateSmtp).mockResolvedValue(undefined);
    const smtpForm = createRef<SMTPTabHandle>();
    render(
      <QueryClientProvider client={queryClient}>
        <SMTPTab ref={smtpForm} inline channelEnabled />
      </QueryClientProvider>,
    );
    await waitFor(() => expect(screen.getByDisplayValue("smtp.example.test")).toBeVisible());
    expect(screen.queryByRole("switch", { name: "SMTP" })).not.toBeInTheDocument();
    expect(screen.queryByRole("switch", { name: "enabled" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "send_test_email" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /save/ })).not.toBeInTheDocument();
    await act(async () => {
      await smtpForm.current!.save();
    });
    await waitFor(() =>
      expect(serverSettingsService.updateSmtp).toHaveBeenCalledWith(
        expect.objectContaining({ host: "smtp.example.test", enabled: true }),
      ),
    );
  });

  it("shows disabled SMTP settings without an inner activation switch", async () => {
    vi.mocked(serverSettingsService.getSmtp).mockResolvedValue({
      enabled: false,
      host: "smtp.example.test",
    });
    render(
      <QueryClientProvider client={queryClient}>
        <SMTPTab inline channelEnabled={false} />
      </QueryClientProvider>,
    );
    expect(await screen.findByDisplayValue("smtp.example.test")).toBeVisible();
    expect(screen.queryByRole("switch", { name: "disabled" })).not.toBeInTheDocument();
    expect(screen.getByDisplayValue("smtp.example.test")).toBeDisabled();
    expect(screen.queryByRole("button", { name: /save/ })).not.toBeInTheDocument();
  });

  it("preserves SMTP draft fields when the shared header changes activation", async () => {
    vi.mocked(serverSettingsService.getSmtp).mockResolvedValue({
      enabled: true,
      host: "smtp.example.test",
    });
    const view = render(
      <QueryClientProvider client={queryClient}>
        <SMTPTab inline channelEnabled />
      </QueryClientProvider>,
    );
    await screen.findByDisplayValue("smtp.example.test");
    await userEvent.clear(screen.getByDisplayValue("smtp.example.test"));
    await userEvent.type(screen.getByPlaceholderText("smtp.example.com"), "draft.example.test");
    await userEvent.type(screen.getByPlaceholderText("password"), "draft-password");
    queryClient.setQueryData(queryKeys.admin.smtp(), { enabled: false, host: "smtp.example.test" });
    view.rerender(
      <QueryClientProvider client={queryClient}>
        <SMTPTab inline channelEnabled={false} />
      </QueryClientProvider>,
    );
    expect(screen.getByDisplayValue("draft.example.test")).toHaveValue("draft.example.test");
    expect(screen.getByPlaceholderText("password")).toHaveValue("draft-password");
  });

  it("renders correctly and loads data", async () => {
    vi.mocked(serverSettingsService.getSmtp).mockResolvedValue({
      enabled: 1,
      host: "smtp.mail.com",
      port: 587,
      username: "user",
      tls: 1,
      authMethod: "PLAIN",
      senderAddress: "no-reply@test.com",
      senderName: "Test",
      hasPassword: 1,
    } as any);

    renderComponent();

    expect(screen.queryByRole("heading", { name: "SMTP" })).not.toBeInTheDocument();

    await waitFor(() => {
      expect(serverSettingsService.getSmtp).toHaveBeenCalled();
    });

    // Check if form is populated
    expect(await screen.findByDisplayValue("smtp.mail.com")).toBeInTheDocument();
    expect(screen.getByDisplayValue("user")).toBeInTheDocument();
  });
  it("shows a closed SMTP provider card, persists its switch, and hides disabled settings", async () => {
    vi.mocked(serverSettingsService.getSmtp).mockResolvedValue({
      enabled: false,
      host: "smtp.example.test",
    });
    vi.mocked(serverSettingsService.updateSmtp).mockResolvedValue(undefined);
    renderComponent(true);
    const toggle = await screen.findByRole("switch", { name: "SMTP" });
    await waitFor(() => expect(toggle).toBeEnabled());
    expect(screen.queryByPlaceholderText("587")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "save" })).not.toBeInTheDocument();
    await userEvent.click(toggle);
    await waitFor(() =>
      expect(serverSettingsService.updateSmtp).toHaveBeenCalledWith({ enabled: true }),
    );
    expect(screen.getByDisplayValue("smtp.example.test")).toBeInTheDocument();
    await waitFor(() => expect(toggle).toBeEnabled());
    await userEvent.click(toggle);
    await waitFor(() =>
      expect(serverSettingsService.updateSmtp).toHaveBeenLastCalledWith({ enabled: false }),
    );
    expect(screen.queryByDisplayValue("smtp.example.test")).not.toBeInTheDocument();
  });
  it("restores the enabled state if saving the provider switch fails", async () => {
    vi.mocked(serverSettingsService.getSmtp).mockResolvedValue({
      enabled: true,
      host: "smtp.example.test",
    });
    vi.mocked(serverSettingsService.updateSmtp).mockRejectedValue(new Error("Save failed"));
    renderComponent(true);
    const toggle = await screen.findByRole("switch", { name: "SMTP" });
    await waitFor(() => expect(toggle).toBeEnabled());
    await userEvent.click(toggle);
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Save failed"));
    expect(toggle).toBeChecked();
    expect(screen.getByDisplayValue("smtp.example.test")).toBeInTheDocument();
  });
  it("collapses active SMTP settings without saving, disabling, or losing an unsaved password", async () => {
    vi.mocked(serverSettingsService.getSmtp).mockResolvedValue({
      enabled: true,
      host: "smtp.example.test",
    });
    renderComponent(true);
    await waitFor(() => expect(screen.getByRole("switch", { name: "SMTP" })).toBeEnabled());
    await userEvent.type(screen.getByPlaceholderText("password"), "unsaved-password");
    await userEvent.click(screen.getByRole("button", { name: "SMTP · collapse_settings" }));
    expect(screen.getByRole("switch", { name: "SMTP" })).toBeChecked();
    expect(screen.getByPlaceholderText("password")).not.toBeVisible();
    expect(serverSettingsService.updateSmtp).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "SMTP · expand_settings" }));
    expect(screen.getByPlaceholderText("password")).toHaveValue("unsaved-password");
    expect(screen.getByDisplayValue("smtp.example.test")).toBeVisible();
    expect(serverSettingsService.updateSmtp).not.toHaveBeenCalled();
  });

  it("handles getSmtp with missing data", async () => {
    vi.mocked(serverSettingsService.getSmtp).mockResolvedValue({} as any);

    renderComponent();

    await waitFor(() => {
      expect(serverSettingsService.getSmtp).toHaveBeenCalled();
    });
  });

  it("updates form state when child components trigger setField", async () => {
    vi.mocked(serverSettingsService.getSmtp).mockResolvedValue({} as any);

    const { container } = renderComponent();

    await waitFor(() => {
      expect(serverSettingsService.getSmtp).toHaveBeenCalled();
    });

    // Trigger onEnabledChange (first switch is the enabled switch from SMTPStatusCard)
    const switches = screen.getAllByRole("switch");
    await userEvent.click(switches[0]);

    // Test port field change
    const portInput = container.querySelector('input[placeholder="587"]') as HTMLInputElement;
    await userEvent.clear(portInput);
    await userEvent.type(portInput, "465");
  });

  it("handles save success", async () => {
    vi.mocked(serverSettingsService.getSmtp).mockResolvedValue({
      enabled: 1,
      host: "smtp.mail.com",
    } as any);
    vi.mocked(serverSettingsService.updateSmtp).mockResolvedValue({} as any);

    renderComponent();

    await waitFor(() => {
      expect(serverSettingsService.getSmtp).toHaveBeenCalled();
    });

    const saveBtn = screen.getByRole("button", { name: "save" });
    await userEvent.click(saveBtn);

    await waitFor(() => {
      expect(serverSettingsService.updateSmtp).toHaveBeenCalled();
    });
    expect(toast.success).toHaveBeenCalledWith("saved");
  });

  it("handles save with password and deletes empty password", async () => {
    vi.mocked(serverSettingsService.getSmtp).mockResolvedValue({
      enabled: 1,
    } as any);
    vi.mocked(serverSettingsService.updateSmtp).mockResolvedValue({} as any);

    renderComponent();

    await waitFor(() => {
      expect(serverSettingsService.getSmtp).toHaveBeenCalled();
    });

    // Type a password
    const pwdInput = await screen.findByPlaceholderText("password");
    await userEvent.type(pwdInput, "newpass");

    const saveBtn = screen.getByRole("button", { name: "save" });
    await userEvent.click(saveBtn);

    await waitFor(() => {
      expect(serverSettingsService.updateSmtp).toHaveBeenCalledWith(
        expect.objectContaining({ password: "newpass" }),
      );
    });
  });

  it("handles save error", async () => {
    vi.mocked(serverSettingsService.getSmtp).mockResolvedValue({} as any);
    vi.mocked(serverSettingsService.updateSmtp).mockRejectedValue(new Error("Save failed"));

    renderComponent();

    await waitFor(() => {
      expect(serverSettingsService.getSmtp).toHaveBeenCalled();
    });

    const saveBtn = screen.getByRole("button", { name: "save" });
    await userEvent.click(saveBtn);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Save failed");
    });
  });

  it("handles save error fallback", async () => {
    vi.mocked(serverSettingsService.getSmtp).mockResolvedValue({} as any);
    vi.mocked(serverSettingsService.updateSmtp).mockRejectedValue("String error");

    renderComponent();

    await waitFor(() => {
      expect(serverSettingsService.getSmtp).toHaveBeenCalled();
    });

    const saveBtn = screen.getByRole("button", { name: "save" });
    await userEvent.click(saveBtn);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("error");
    });
  });

  it("handles send test email success", async () => {
    // Has to be enabled to click test email button
    vi.mocked(serverSettingsService.getSmtp).mockResolvedValue({ enabled: 1 } as any);
    vi.mocked(serverSettingsService.testSmtp).mockResolvedValue({} as any);

    renderComponent();

    await waitFor(() => {
      expect(serverSettingsService.getSmtp).toHaveBeenCalled();
    });

    const sendTestBtn = await screen.findByRole("button", { name: "send_test_email" });
    await userEvent.click(sendTestBtn);

    await waitFor(() => {
      expect(serverSettingsService.testSmtp).toHaveBeenCalled();
    });
    expect(toast.success).toHaveBeenCalledWith("test_sent");
  });

  it("handles send test email error", async () => {
    vi.mocked(serverSettingsService.getSmtp).mockResolvedValue({ enabled: 1 } as any);
    vi.mocked(serverSettingsService.testSmtp).mockRejectedValue(new Error("Test failed"));

    renderComponent();

    await waitFor(() => {
      expect(serverSettingsService.getSmtp).toHaveBeenCalled();
    });

    const sendTestBtn = await screen.findByRole("button", { name: "send_test_email" });
    await userEvent.click(sendTestBtn);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Test failed");
    });
  });

  it("handles send test email error fallback", async () => {
    vi.mocked(serverSettingsService.getSmtp).mockResolvedValue({ enabled: 1 } as any);
    vi.mocked(serverSettingsService.testSmtp).mockRejectedValue("String error");

    renderComponent();

    await waitFor(() => {
      expect(serverSettingsService.getSmtp).toHaveBeenCalled();
    });

    const sendTestBtn = await screen.findByRole("button", { name: "send_test_email" });
    await userEvent.click(sendTestBtn);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("error");
    });
  });
});
