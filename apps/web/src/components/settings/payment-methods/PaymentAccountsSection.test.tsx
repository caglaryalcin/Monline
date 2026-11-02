import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import { PaymentAccountsSection } from "./PaymentAccountsSection";

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "user-a" } }) }));
vi.mock("@/services/paymentAccounts", () => ({ paymentAccountsService: mocks }));
vi.mock("@/lib/toast", () => ({ toast: { success: mocks.success, error: mocks.error } }));
beforeEach(() => {
  vi.clearAllMocks();
  mocks.list.mockResolvedValue([{ id: "joint", name: "Joint account", user: "user-a" }]);
  mocks.create.mockResolvedValue({});
  mocks.update.mockResolvedValue({});
  mocks.delete.mockResolvedValue(true);
});
function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <PaymentAccountsSection />
    </QueryClientProvider>,
  );
}
it("loads saved accounts and creates a named account for the signed-in user", async () => {
  setup();
  await screen.findByText("Joint account");
  expect(mocks.list).toHaveBeenCalledWith("user-a");
  fireEvent.change(screen.getByLabelText("payment_account_name"), {
    target: { value: " My bank " },
  });
  fireEvent.click(screen.getByRole("button", { name: "add" }));
  await waitFor(() => expect(mocks.create).toHaveBeenCalledWith("user-a", "My bank"));
  await waitFor(() => expect(screen.getByLabelText("payment_account_name")).toHaveValue(""));
});
it("renames an account and requires confirmation before deleting it", async () => {
  setup();
  await screen.findByText("Joint account");
  fireEvent.click(screen.getByRole("button", { name: "edit · Joint account" }));
  fireEvent.change(screen.getByLabelText("payment_account_name"), {
    target: { value: "Family account" },
  });
  fireEvent.click(screen.getByRole("button", { name: "save" }));
  await waitFor(() => expect(mocks.update).toHaveBeenCalledWith("joint", "Family account"));
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "delete · Joint account" })).toBeEnabled(),
  );
  fireEvent.click(screen.getByRole("button", { name: "delete · Joint account" }));
  expect(mocks.delete).not.toHaveBeenCalled();
  fireEvent.click(
    within(screen.getByRole("alertdialog")).getByRole("button", { name: "delete" }),
  );
  await waitFor(() => expect(mocks.delete).toHaveBeenCalledWith("joint"));
});
it("keeps a failed save editable and reports the failure", async () => {
  mocks.create.mockRejectedValue(new Error("unavailable"));
  setup();
  await screen.findByText("Joint account");
  fireEvent.change(screen.getByLabelText("payment_account_name"), {
    target: { value: "Personal" },
  });
  fireEvent.click(screen.getByRole("button", { name: "add" }));
  await waitFor(() => expect(mocks.error).toHaveBeenCalled());
  expect(screen.getByLabelText("payment_account_name")).toHaveValue("Personal");
});
