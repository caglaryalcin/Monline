import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";

import { toast } from "@/lib/toast";

import { BulkSettingsActions } from "./BulkSettingsActions";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params?.count ? `${key} ${params.count}` : key,
  }),
}));
vi.mock("@/lib/toast", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const onUpdate = vi.fn();
const onDelete = vi.fn();
const onChanged = vi.fn();
const items = [
  { id: "usd", label: "USD", values: { name: "Dollar", code: "USD" } },
  { id: "eur", label: "EUR", values: { name: "Euro", code: "EUR" } },
];
function Harness() {
  const [selected, setSelected] = useState(new Set<string>());
  return (
    <BulkSettingsActions
      items={items}
      fields={[
        { key: "name", label: "Name", required: true },
        { key: "code", label: "Code", required: true },
      ]}
      selected={selected}
      onSelect={setSelected}
      onUpdate={onUpdate}
      onDelete={onDelete}
      onChanged={onChanged}
    />
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  onUpdate.mockResolvedValue({});
  onDelete.mockResolvedValue({});
});
function editAll() {
  fireEvent.click(screen.getByRole("checkbox", { name: "select_all" }));
  fireEvent.click(screen.getByRole("button", { name: "edit_selected" }));
}
it("selects and deselects all records", () => {
  render(<Harness />);
  fireEvent.click(screen.getByRole("checkbox"));
  expect(screen.getByText("selected_items 2")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("checkbox"));
  expect(screen.queryByRole("button", { name: "edit_selected" })).not.toBeInTheDocument();
});
it("edits separate selected rows and saves only changed fields", async () => {
  render(<Harness />);
  editAll();
  fireEvent.change(screen.getByLabelText("USD · Name"), { target: { value: "US Dollar" } });
  fireEvent.change(screen.getByLabelText("EUR · Code"), { target: { value: "EURO" } });
  fireEvent.click(screen.getByRole("button", { name: "save" }));
  await waitFor(() => expect(onChanged).toHaveBeenCalledOnce());
  expect(onUpdate).toHaveBeenCalledWith("usd", { name: "US Dollar" });
  expect(onUpdate).toHaveBeenCalledWith("eur", { code: "EURO" });
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});
it("does not submit blank required fields or change anything on cancel", () => {
  render(<Harness />);
  editAll();
  fireEvent.change(screen.getByLabelText("USD · Name"), { target: { value: "   " } });
  expect(screen.getByRole("button", { name: "save" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "cancel" }));
  expect(onUpdate).not.toHaveBeenCalled();
});
it("keeps only failed rows and their unsaved values available for retry", async () => {
  onUpdate.mockImplementation((id) =>
    id === "usd" ? Promise.reject(new Error("failed")) : Promise.resolve({}),
  );
  render(<Harness />);
  editAll();
  fireEvent.change(screen.getByLabelText("USD · Name"), { target: { value: "US Dollar" } });
  fireEvent.change(screen.getByLabelText("EUR · Name"), { target: { value: "European Euro" } });
  fireEvent.click(screen.getByRole("button", { name: "save" }));
  await waitFor(() => expect(toast.error).toHaveBeenCalledWith("bulk_partial_failure 1"));
  expect(screen.getByLabelText("USD · Name")).toHaveValue("US Dollar");
  expect(screen.queryByLabelText("EUR · Name")).not.toBeInTheDocument();
  expect(screen.getByText("selected_items 1")).toBeInTheDocument();
  onUpdate.mockResolvedValue({});
  fireEvent.click(screen.getByRole("button", { name: "save" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
});
it("requires confirmation before deleting selected records", async () => {
  render(<Harness />);
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(screen.getByRole("button", { name: "delete_selected" }));
  expect(onDelete).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "delete" }));
  await waitFor(() => expect(onChanged).toHaveBeenCalledOnce());
  expect(onDelete).toHaveBeenCalledWith("usd");
  expect(onDelete).toHaveBeenCalledWith("eur");
});
