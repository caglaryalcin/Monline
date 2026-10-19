import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Mail } from "lucide-react";

import type { ProviderConfig } from "@/components/settings/notifications/config";
import { PROVIDERS } from "@/components/settings/notifications/config";
import { LS_KEYS } from "@/lib/constants";
import type { NotificationsConfig } from "@/types";

import { ProviderCard } from "./ProviderCard";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string, fallback?: string) => fallback ?? key }),
}));

describe("ProviderCard", () => {
  beforeEach(() => localStorage.clear());
  it("renders labelled ntfy authentication inputs with masked secrets and authentication guidance", () => {
    render(
      <ProviderCard
        provider={PROVIDERS.find((item) => item.id === "ntfy")!}
        formData={{ ntfy_enabled: true, ntfy_username: "demo", ntfy_password: "demo-password" }}
        onChange={vi.fn()}
        onTest={vi.fn()}
        isTesting={false}
      />,
    );
    expect(screen.getByLabelText("username")).toHaveValue("demo");
    expect(screen.getByLabelText("password")).toHaveAttribute("type", "password");
    expect(screen.getByLabelText("token")).toHaveAttribute("type", "password");
    expect(screen.getByText("ntfy_auth_hint")).toBeInTheDocument();
  });
  const provider: ProviderConfig = {
    id: "email",
    label: "Email",
    descriptionKey: "provider_email_desc",
    icon: Mail,
    colorClass: "text-primary",
    bgClass: "bg-primary/10",
    borderClass: "border-primary/30",
    enabledKey: "email_enabled",
    fields: [
      {
        key: "email_to",
        labelKey: "destination_email",
        type: "email",
        placeholder: "you@domain.com",
      },
    ],
  };

  it("toggles the provider on and reveals its settings", async () => {
    const onChange = vi.fn();
    render(
      <ProviderCard
        provider={provider}
        formData={{}}
        onChange={onChange}
        onTest={vi.fn()}
        isTesting={false}
      />,
    );

    await userEvent.click(screen.getByRole("switch"));

    expect(onChange).toHaveBeenCalledWith("email_enabled", true);
  });

  it("updates provider fields and runs a test notification", async () => {
    const onChange = vi.fn();
    const onTest = vi.fn();

    render(
      <ProviderCard
        provider={provider}
        formData={
          { email_enabled: true, email_to: "old@example.com" } as Partial<NotificationsConfig>
        }
        onChange={onChange}
        onTest={onTest}
        isTesting={false}
      />,
    );

    await userEvent.clear(screen.getByDisplayValue("old@example.com"));
    await userEvent.type(screen.getByPlaceholderText("you@domain.com"), "new@example.com");
    await userEvent.click(screen.getByRole("button", { name: "Test" }));

    expect(onChange).toHaveBeenCalledWith("email_to", expect.any(String));
    expect(onTest).toHaveBeenCalledTimes(1);
  });

  it("applies sm:grid-cols-2 when provider has more than one field", () => {
    const multiFieldProvider: ProviderConfig = {
      ...provider,
      id: "telegram",
      label: "Telegram",
      enabledKey: "telegram_enabled",
      fields: [
        {
          key: "telegram_bot_token",
          labelKey: "bot_token",
          type: "text",
          placeholder: "123456:ABC",
        },
        {
          key: "telegram_chat_id",
          labelKey: "chat_id",
          type: "text",
          placeholder: "-1001234567890",
        },
      ],
    };

    const { container } = render(
      <ProviderCard
        provider={multiFieldProvider}
        formData={{ telegram_enabled: true } as Partial<NotificationsConfig>}
        onChange={vi.fn()}
        onTest={vi.fn()}
        isTesting={false}
      />,
    );

    const grid = container.querySelector(".grid");
    expect(grid?.className).toContain("sm:grid-cols-2");
  });

  it("disables the test button while a test is in progress", () => {
    render(
      <ProviderCard
        provider={provider}
        formData={{ email_enabled: true } as Partial<NotificationsConfig>}
        onChange={vi.fn()}
        onTest={vi.fn()}
        isTesting
      />,
    );

    expect(screen.getByRole("button", { name: "Sending…" })).toBeDisabled();
  });
  it("collapses an enabled provider without disabling it or losing draft fields", async () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <ProviderCard
        provider={provider}
        formData={{ email_enabled: true, email_to: "draft@example.test" }}
        onChange={onChange}
        onTest={vi.fn()}
        isTesting={false}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Email · collapse_settings" }));
    expect(screen.getByRole("switch")).toBeChecked();
    expect(screen.getByDisplayValue("draft@example.test")).not.toBeVisible();
    expect(onChange).not.toHaveBeenCalled();
    rerender(
      <ProviderCard
        provider={provider}
        formData={{ email_enabled: true, email_to: "draft@example.test" }}
        onChange={onChange}
        onTest={vi.fn()}
        isTesting={false}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Email · expand_settings" }));
    expect(screen.getByDisplayValue("draft@example.test")).toBeVisible();
    expect(onChange).not.toHaveBeenCalled();
  });
  it("lets an administrator configure SMTP while personal email notifications remain disabled", async () => {
    const onChange = vi.fn();
    render(
      <ProviderCard
        provider={provider}
        formData={{}}
        onChange={onChange}
        onTest={vi.fn()}
        isTesting={false}
        allowConfigureDisabled
      >
        <div>SMTP settings</div>
      </ProviderCard>,
    );
    expect(screen.getByText("SMTP settings")).not.toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Email · expand_settings" }));
    expect(screen.getByText("SMTP settings")).toBeVisible();
    expect(screen.getByRole("switch")).not.toBeChecked();
    expect(screen.getByPlaceholderText("you@domain.com")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Test" })).toBeDisabled();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("toggles settings from the header label, description and keyboard", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <ProviderCard
        provider={provider}
        formData={{ email_enabled: true, email_to: "draft@example.test" }}
        onChange={onChange}
        onTest={vi.fn()}
        isTesting={false}
      />,
    );
    const header = screen.getByRole("button", { name: "Email" });
    await user.click(screen.getAllByText("Email")[0]);
    expect(header).toHaveAttribute("aria-expanded", "false");
    await user.click(header);
    expect(header).toHaveAttribute("aria-expanded", "true");
    await user.click(screen.getAllByText("Email")[1]);
    expect(header).toHaveAttribute("aria-expanded", "false");
    await user.keyboard("{Enter}");
    expect(header).toHaveAttribute("aria-expanded", "true");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("keeps the provider switch independent from the header disclosure", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <ProviderCard
        provider={provider}
        formData={{ email_enabled: true }}
        onChange={onChange}
        onTest={vi.fn()}
        isTesting={false}
      />,
    );
    const header = screen.getByRole("button", { name: "Email" });
    await user.click(header);
    await user.click(screen.getByRole("switch"));
    expect(onChange).toHaveBeenCalledExactlyOnceWith("email_enabled", false);
    expect(header).toHaveAttribute("aria-expanded", "false");
  });

  it("restores collapsed and expanded choices after navigating away, separately per account and provider", async () => {
    const user = userEvent.setup();
    const props = {
      provider,
      formData: { email_enabled: true },
      onChange: vi.fn(),
      onTest: vi.fn(),
      isTesting: false,
    };
    const storageKey = LS_KEYS.notificationDisclosure("user-1", "email");
    const firstVisit = render(<ProviderCard {...props} disclosureStorageKey={storageKey} />);
    await user.click(screen.getByRole("button", { name: "Email" }));
    firstVisit.unmount();

    const secondVisit = render(<ProviderCard {...props} disclosureStorageKey={storageKey} />);
    expect(screen.getByRole("button", { name: "Email" })).toHaveAttribute("aria-expanded", "false");
    await user.click(screen.getByRole("button", { name: "Email" }));
    secondVisit.unmount();

    const thirdVisit = render(<ProviderCard {...props} disclosureStorageKey={storageKey} />);
    expect(screen.getByRole("button", { name: "Email" })).toHaveAttribute("aria-expanded", "true");
    await user.click(screen.getByRole("button", { name: "Email" }));
    thirdVisit.unmount();

    for (const otherKey of [
      LS_KEYS.notificationDisclosure("user-2", "email"),
      LS_KEYS.notificationDisclosure("user-1", "telegram"),
    ]) {
      const otherVisit = render(<ProviderCard {...props} disclosureStorageKey={otherKey} />);
      expect(screen.getByRole("button", { name: "Email" })).toHaveAttribute(
        "aria-expanded",
        "true",
      );
      otherVisit.unmount();
    }
  });

  it("still toggles settings when browser storage is unavailable", async () => {
    const getItem = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("Storage unavailable");
    });
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("Storage unavailable");
    });
    try {
      render(
        <ProviderCard
          provider={provider}
          formData={{ email_enabled: true }}
          onChange={vi.fn()}
          onTest={vi.fn()}
          isTesting={false}
          disclosureStorageKey={LS_KEYS.notificationDisclosure("user-1", "email")}
        />,
      );
      const header = screen.getByRole("button", { name: "Email" });
      await userEvent.click(header);
      expect(header).toHaveAttribute("aria-expanded", "false");
    } finally {
      getItem.mockRestore();
      setItem.mockRestore();
    }
  });
});
