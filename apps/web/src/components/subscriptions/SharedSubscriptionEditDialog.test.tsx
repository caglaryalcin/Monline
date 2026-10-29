import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { SharedSubscription } from "@/services/sharing";
import type * as SharingModule from "@/services/sharing";
import { createQueryClientWrapper } from "@/test/query-client";

import { SharedSubscriptionEditDialog } from "./SharedSubscriptionEditDialog";

const { payers, updateShared } = vi.hoisted(() => ({ payers: vi.fn(), updateShared: vi.fn() }));
vi.mock("@/services/sharing", async (importOriginal) => {
  const original = await importOriginal<typeof SharingModule>();
  return { ...original, sharingService: { ...original.sharingService, payers, updateShared } };
});
vi.mock("@/services/cycles", () => ({
  cyclesService: { list: vi.fn().mockResolvedValue([{ id: "monthly", name: "Monthly" }]) },
}));
vi.mock("@/lib/toast", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
const sub = {
  id: "sub-1",
  user: "owner",
  name: "HBO",
  price: 300,
  cycle: "monthly",
  frequency: 1,
  next_payment: "2026-11-28",
  auto_renew: true,
  inactive: false,
  record_type: "expense",
  payer: "owner-person",
  expand: {
    payer: { id: "owner-person", name: "Owner", user: "owner" },
    currency: { code: "TRY" },
  },
} as SharedSubscription;
function show() {
  const { Wrapper } = createQueryClientWrapper();
  return render(<SharedSubscriptionEditDialog sub={sub} userId="recipient" onClose={vi.fn()} />, {
    wrapper: Wrapper,
  });
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
    },
  );
  HTMLElement.prototype.scrollIntoView = vi.fn();
  HTMLElement.prototype.hasPointerCapture = vi.fn(() => false);
  HTMLElement.prototype.setPointerCapture = vi.fn();
  HTMLElement.prototype.releasePointerCapture = vi.fn();
  payers.mockResolvedValue([
    { value: "owner-person", name: "Owner" },
    { value: "account:recipient", name: "Recipient" },
  ]);
  updateShared.mockResolvedValue({ id: sub.id });
});
it("shows the payer picker, saves the selected account, and has no URL editing field", async () => {
  show();
  const picker = await screen.findByRole("combobox", { name: "payer" });
  await waitFor(() => expect(picker).toBeEnabled());
  expect(screen.queryByLabelText("url")).not.toBeInTheDocument();
  await userEvent.click(picker);
  await userEvent.click(await screen.findByRole("option", { name: "Recipient" }));
  await userEvent.click(screen.getByRole("button", { name: "save" }));
  await waitFor(() =>
    expect(updateShared).toHaveBeenCalledWith(
      "sub-1",
      expect.objectContaining({ payer: "account:recipient" }),
    ),
  );
  expect(updateShared.mock.lastCall?.[1]).not.toHaveProperty("url");
});
it("does not overwrite an unchanged payer when the payer options cannot be loaded", async () => {
  payers.mockRejectedValue(new Error("offline"));
  show();
  await screen.findByRole("alert");
  expect(screen.getByRole("combobox", { name: "payer" })).toBeDisabled();
  await userEvent.click(screen.getByRole("button", { name: "save" }));
  await waitFor(() => expect(updateShared).toHaveBeenCalled());
  expect(updateShared.mock.lastCall?.[1]).not.toHaveProperty("payer");
});
