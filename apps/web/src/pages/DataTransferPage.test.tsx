import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { createQueryClientWrapper } from "@/test/query-client";

import { DataTransferPage } from "./DataTransferPage";

const mocks = vi.hoisted(() => ({
  isAdmin: true,
  exportInstanceBackup: vi.fn(),
  exportBackup: vi.fn(),
}));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "user-1" },
    isAdmin: mocks.isAdmin,
    isLoading: false,
    refreshUser: vi.fn(),
  }),
}));
vi.mock("@/services/dataTransfer", () => ({
  TRANSFER_COLLECTIONS: [],
  exportInstanceBackup: mocks.exportInstanceBackup,
  exportBackup: mocks.exportBackup,
  importData: vi.fn(),
  readImportFile: vi.fn(),
}));

function setup() {
  const { Wrapper } = createQueryClientWrapper();
  render(<DataTransferPage />, { wrapper: Wrapper });
  return userEvent.setup();
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.isAdmin = true;
});

it("asks for a password before full export and clears it when cancelled", async () => {
  const user = setup();
  await user.click(screen.getByRole("button", { name: "transfer_export_action" }));
  const dialog = within(screen.getByRole("dialog"));
  expect(dialog.getByLabelText("current_password")).toHaveAttribute("type", "password");
  expect(dialog.getByRole("button", { name: "transfer_export_action" })).toBeDisabled();
  expect(mocks.exportInstanceBackup).not.toHaveBeenCalled();
  await user.type(dialog.getByLabelText("current_password"), "test-only-password");
  await user.click(dialog.getByRole("button", { name: "cancel" }));
  expect(mocks.exportInstanceBackup).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "transfer_export_action" }));
  expect(screen.getByLabelText("current_password")).toHaveValue("");
});

it("reports a wrong password in the dialog and allows retrying the export", async () => {
  mocks.exportInstanceBackup.mockRejectedValueOnce(new Error("transfer_invalid_password"));
  const user = setup();
  await user.click(screen.getByRole("button", { name: "transfer_export_action" }));
  const dialog = within(screen.getByRole("dialog"));
  await user.type(dialog.getByLabelText("current_password"), "wrong-password");
  await user.click(dialog.getByRole("button", { name: "transfer_export_action" }));
  expect(await dialog.findByRole("alert")).toHaveTextContent("transfer_invalid_password");
  expect(dialog.getByLabelText("current_password")).toHaveValue("");
  await user.type(dialog.getByLabelText("current_password"), "test-only-password");
  await user.click(dialog.getByRole("button", { name: "transfer_export_action" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  expect(mocks.exportInstanceBackup).toHaveBeenNthCalledWith(1, "wrong-password");
  expect(mocks.exportInstanceBackup).toHaveBeenNthCalledWith(2, "test-only-password");
});

it("prevents duplicate submissions while the backup is being prepared", async () => {
  let complete!: () => void;
  mocks.exportInstanceBackup.mockReturnValue(
    new Promise<void>((resolve) => {
      complete = resolve;
    }),
  );
  const user = setup();
  await user.click(screen.getByRole("button", { name: "transfer_export_action" }));
  const dialog = within(screen.getByRole("dialog"));
  await user.type(dialog.getByLabelText("current_password"), "test-only-password");
  await user.click(dialog.getByRole("button", { name: "transfer_export_action" }));
  expect(dialog.getByRole("button", { name: "transfer_preparing" })).toBeDisabled();
  expect(dialog.getByRole("button", { name: "cancel" })).toBeDisabled();
  await user.keyboard("{Escape}");
  expect(screen.getByRole("dialog")).toBeInTheDocument();
  expect(mocks.exportInstanceBackup).toHaveBeenCalledTimes(1);
  complete();
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
});

it("keeps account JSON export available for non-administrators", async () => {
  mocks.isAdmin = false;
  const user = setup();
  await user.click(screen.getByRole("button", { name: "transfer_export_action" }));
  await waitFor(() => expect(mocks.exportBackup).toHaveBeenCalledTimes(1));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(mocks.exportInstanceBackup).not.toHaveBeenCalled();
});
