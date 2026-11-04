import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { type ReactNode, useState } from "react";

import { NotificationTemplateEditor } from "@/components/admin/NotificationTemplateEditor";
import type { NotificationEvent, NotificationTemplates } from "@/types";

const mocks = vi.hoisted(() => ({ preview: vi.fn(), error: vi.fn(), t: (key: string) => key }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: mocks.t }) }));
vi.mock("@/services/notifications", () => ({ notificationsService: { previewTemplate: mocks.preview } }));
vi.mock("@/lib/toast", () => ({ toast: { error: mocks.error } }));
vi.mock("@/components/ui/persistent-details", () => ({
  PersistentDetails: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

function Harness() {
  const [event, setEvent] = useState<NotificationEvent>("payment");
  const [templates, setTemplates] = useState<NotificationTemplates["email"]>({
    payment: { title: "Initial subject", message: "Initial body" },
    cancellation: { title: "Cancellation subject", message: "Cancellation body" },
  });
  return <NotificationTemplateEditor providerId="email" language="en" event={event}
    onEventChange={setEvent} templates={templates || {}} onChange={setTemplates} disabled={false} />;
}

beforeEach(() => {
  mocks.preview.mockReset();
  mocks.error.mockClear();
  mocks.preview.mockImplementation(async (_provider: string, event: NotificationEvent, draft: NotificationTemplates) => {
    const fields = draft.email?.[event];
    return { title: fields?.title || "Default subject", message: fields?.message || "Default body", html: `<p>${fields?.message || "Default body"}</p>` };
  });
});
afterEach(cleanup);

async function open() {
  render(<Harness />);
  fireEvent.click(screen.getByRole("button", { name: "notification_template_preview" }));
  await screen.findByRole("heading", { name: "Initial subject" });
}

it("separates subject and body in a mailbox preview", async () => {
  await open();
  const preview = screen.getByRole("region", { name: "notification_email_preview" });
  expect(preview).toHaveTextContent("notification_email_preview_inbox");
  const iframe = screen.getByTitle("notification_email_preview_body");
  expect(iframe).toHaveAttribute("srcdoc", "<p>Initial body</p>");
  expect(iframe).toHaveAttribute("sandbox", "");
  expect(iframe).toHaveAttribute("referrerpolicy", "no-referrer");
});

it("keeps the preview visible and inputs editable while refreshing the draft", async () => {
  await open();
  fireEvent.change(screen.getByLabelText("notification_template_subject"), { target: { value: "Updated subject" } });
  fireEvent.change(screen.getByLabelText("notification_template_plain_text"), { target: { value: "Updated body" } });
  expect(screen.getByRole("heading", { name: "Initial subject" })).toBeInTheDocument();
  expect(screen.getByLabelText("notification_template_subject")).toBeEnabled();
  await screen.findByRole("heading", { name: "Updated subject" });
  expect(screen.getByTitle("notification_email_preview_body")).toHaveAttribute("srcdoc", "<p>Updated body</p>");
  expect(mocks.preview).toHaveBeenCalledTimes(2);
});

it("ignores an older response that arrives after the latest draft", async () => {
  await open();
  let resolveOld: ((value: { title: string; message: string; html: string }) => void) | undefined;
  mocks.preview.mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve; }));
  fireEvent.change(screen.getByLabelText("notification_template_subject"), { target: { value: "Old draft" } });
  await waitFor(() => expect(mocks.preview).toHaveBeenCalledTimes(2));
  fireEvent.change(screen.getByLabelText("notification_template_subject"), { target: { value: "Newest draft" } });
  await screen.findByRole("heading", { name: "Newest draft" });
  await act(async () => resolveOld?.({ title: "Old draft", message: "old", html: "old" }));
  expect(screen.getByRole("heading", { name: "Newest draft" })).toBeInTheDocument();
});

it("refreshes after changing reminder type and resetting without closing the preview", async () => {
  await open();
  fireEvent.click(screen.getByRole("button", { name: "notification_template_cancellation" }));
  await screen.findByRole("heading", { name: "Cancellation subject" });
  fireEvent.click(screen.getByRole("button", { name: "notification_template_reset" }));
  expect(screen.getByRole("region", { name: "notification_email_preview" })).toBeInTheDocument();
  await screen.findByRole("heading", { name: "Default subject" });
});
