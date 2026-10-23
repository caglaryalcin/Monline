import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { createQueryClientWrapper } from "@/test/query-client";

const mocks = vi.hoisted(() => ({
  exportBackup: vi.fn(),
  readScopedImport: vi.fn(),
  importScopedData: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@/services/dataTransfer", () => ({
  exportBackup: mocks.exportBackup,
  readScopedImport: mocks.readScopedImport,
  importScopedData: mocks.importScopedData,
}));
vi.mock("@/lib/toast", () => ({ toast: { success: mocks.success, error: mocks.error } }));
import { ScopedTransferActions } from "./ScopedTransferActions";

beforeEach(() => vi.clearAllMocks());
it.each(["calendar", "subscriptions"] as const)(
  "exports only %s and waits for confirmation before importing",
  async (scope) => {
    const { client, Wrapper } = createQueryClientWrapper();
    const invalidate = vi.spyOn(client, "invalidateQueries").mockResolvedValue(undefined);
    const backup = {
      format: "monline-scoped-backup",
      version: 1,
      scope,
      backup: { data: { payment_records: [{ id: "pay" }], subscriptions: [{ id: "sub" }] } },
    };
    mocks.readScopedImport.mockResolvedValue(backup);
    mocks.importScopedData.mockResolvedValue({ imported: 1, skipped: 0 });
    const label = scope === "calendar" ? "calendar_transfer" : "subscriptions_transfer";
    render(<ScopedTransferActions scope={scope} />, { wrapper: Wrapper });
    await userEvent.click(screen.getByRole("button", { name: `${label}: export` }));
    expect(mocks.exportBackup).toHaveBeenCalledWith(expect.any(Function), scope);
    const file = new File(["{}"], "scope.json", { type: "application/json" });
    await userEvent.upload(screen.getByLabelText(`${label}: import`, { selector: "input" }), file);
    await screen.findByRole("dialog");
    expect(mocks.readScopedImport).toHaveBeenCalledWith(file, scope);
    expect(mocks.importScopedData).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: /^import$/ }));
    await waitFor(() => expect(mocks.importScopedData).toHaveBeenCalledWith(backup));
    expect(invalidate).toHaveBeenCalledWith();
  },
);

it("rejects an incompatible file without importing it", async () => {
  mocks.readScopedImport.mockRejectedValue(new Error("transfer_invalid_backup"));
  const { Wrapper } = createQueryClientWrapper();
  render(<ScopedTransferActions scope="calendar" />, { wrapper: Wrapper });
  await userEvent.upload(
    screen.getByLabelText("calendar_transfer: import", { selector: "input" }),
    new File(["{}"], "wrong.json", { type: "application/json" }),
  );
  await waitFor(() => expect(mocks.error).toHaveBeenCalledWith("transfer_invalid_backup"));
  expect(mocks.importScopedData).not.toHaveBeenCalled();
});
