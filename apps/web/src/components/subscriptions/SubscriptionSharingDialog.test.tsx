import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AnchorHTMLAttributes } from "react";

import type * as SharingModule from "@/services/sharing";
import { createQueryClientWrapper } from "@/test/query-client";
import type { Subscription } from "@/types";

import { SubscriptionSharingDialog } from "./SubscriptionSharingDialog";

const { access, groups, saveAccess, setEnabled } = vi.hoisted(() => ({
  access: vi.fn(),
  groups: vi.fn(),
  saveAccess: vi.fn(),
  setEnabled: vi.fn(),
}));
vi.mock("@/services/sharing", async (importOriginal) => {
  const original = await importOriginal<typeof SharingModule>();
  return {
    ...original,
    sharingService: { ...original.sharingService, access, groups, saveAccess, setEnabled },
  };
});
vi.mock("@/services/household", () => ({
  householdService: { list: vi.fn().mockResolvedValue([]) },
}));
vi.mock("@/lib/toast", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, values?: { email?: string; name?: string }) =>
      values?.email ? `${key}: ${values.email}` : key,
  }),
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to,
    search: _search,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & { to: string; search?: unknown }) => (
    <a href={to} {...props} />
  ),
}));
const subscription = { id: "subscription-1", name: "HBO" } as Subscription;
function show() {
  const { Wrapper } = createQueryClientWrapper();
  return render(<SubscriptionSharingDialog sub={subscription} userId="owner" onClose={vi.fn()} />, {
    wrapper: Wrapper,
  });
}
beforeEach(() => {
  vi.clearAllMocks();
  groups.mockResolvedValue([]);
  access.mockResolvedValue({
    users: [],
    groups: [],
    groupPermissions: {},
    userPermissions: {},
    is_shared: false,
  });
  saveAccess.mockResolvedValue({
    users: [],
    groups: [],
    groupPermissions: {},
    userPermissions: {},
    is_shared: true,
  });
});
it("turns Enter into a contact chip without submitting, then saves that person's edit permission", async () => {
  show();
  const input = await screen.findByLabelText("sharing_accounts_section");
  await userEvent.type(input, "NEW@example.test{Enter}");
  expect(input).toHaveValue("");
  expect(screen.getByRole("button", { name: "new@example.test" })).toBeInTheDocument();
  expect(saveAccess).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole("radio", { name: "sharing_can_edit" }));
  await userEvent.click(screen.getByRole("button", { name: "save" }));
  await waitFor(() =>
    expect(saveAccess).toHaveBeenCalledWith(
      "subscription-1",
      ["new@example.test"],
      [],
      {},
      { "new@example.test": "edit" },
      {},
    ),
  );
});
it("restores an existing person's saved permission and allows changing it later", async () => {
  access.mockResolvedValue({
    users: [{ id: "recipient", name: "Nas", email: "nas@example.test" }],
    groups: [],
    groupPermissions: {},
    userPermissions: { "nas@example.test": "edit" },
    is_shared: true,
  });
  show();
  expect(await screen.findByRole("radio", { name: "sharing_can_edit" })).toBeChecked();
  await userEvent.click(screen.getByRole("radio", { name: "sharing_read_only" }));
  await userEvent.click(screen.getByRole("button", { name: "save" }));
  await waitFor(() =>
    expect(saveAccess).toHaveBeenCalledWith(
      "subscription-1",
      ["nas@example.test"],
      [],
      {},
      { "nas@example.test": "read" },
      {},
    ),
  );
});
it("deduplicates pasted recipients, permits removal and saves a pending address without losing it", async () => {
  show();
  const input = await screen.findByLabelText("sharing_accounts_section");
  await userEvent.click(input);
  await userEvent.paste("first@example.test; FIRST@example.test; second@example.test");
  expect(screen.getAllByRole("button", { name: "first@example.test" })).toHaveLength(1);
  await userEvent.click(
    screen.getByRole("button", { name: "sharing_remove_recipient: first@example.test" }),
  );
  await userEvent.type(input, "third@example.test");
  await userEvent.click(screen.getByRole("button", { name: "save" }));
  await waitFor(() =>
    expect(saveAccess).toHaveBeenCalledWith(
      "subscription-1",
      ["second@example.test", "third@example.test"],
      [],
      {},
      { "second@example.test": "read", "third@example.test": "read" },
      {},
    ),
  );
});
it("keeps malformed addresses editable and prevents an invalid sharing request", async () => {
  show();
  const input = await screen.findByLabelText("sharing_accounts_section");
  await userEvent.type(input, "not-an-email{Enter}");
  expect(await screen.findByRole("alert")).toHaveTextContent("sharing_invalid_email");
  expect(input).toHaveValue("not-an-email");
  await userEvent.click(screen.getByRole("button", { name: "save" }));
  expect(saveAccess).not.toHaveBeenCalled();
});

it("adds groups through the dropdown without creating direct recipients", async () => {
  groups.mockResolvedValue([
    {
      id: "family",
      name: "Family",
      members: [{ id: "recipient", name: "Nas", email: "nas@example.test" }],
    },
  ]);
  show();
  await userEvent.click(await screen.findByRole("button", { name: "sharing_add_group" }));
  await userEvent.click(await screen.findByRole("menuitem", { name: /Family/ }));
  expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  expect(screen.getByText("Family")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "nas@example.test" })).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("radio", { name: "sharing_can_edit" }));
  await userEvent.click(screen.getByRole("button", { name: "save" }));
  await waitFor(() =>
    expect(saveAccess).toHaveBeenCalledWith(
      "subscription-1",
      [],
      ["family"],
      { family: "edit" },
      {},
      { family: true },
    ),
  );
});

it("removes a group association on save and keeps it available only in Add group on reopening", async () => {
  groups.mockResolvedValue([{ id: "family", name: "Family", members: [] }]);
  access.mockResolvedValue({
    users: [],
    groups: ["family"],
    groupPermissions: { family: "edit" },
    groupEnabled: { family: true },
    enabled: true,
    is_shared: true,
  });
  const view = show();
  await userEvent.click(
    await screen.findByRole("button", { name: "sharing_remove_group_from_subscription" }),
  );
  expect(screen.queryByText("Family")).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "save" }));
  await waitFor(() =>
    expect(saveAccess).toHaveBeenCalledWith("subscription-1", [], [], {}, {}, {}),
  );
  view.unmount();
  access.mockResolvedValue({
    users: [],
    groups: [],
    groupPermissions: {},
    groupEnabled: {},
    enabled: true,
    is_shared: false,
  });
  show();
  expect(await screen.findByRole("button", { name: "sharing_add_group" })).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "sharing_remove_group_from_subscription" }),
  ).not.toBeInTheDocument();
});

it("pauses sharing immediately while keeping recipients and permissions", async () => {
  const stored = {
    users: [{ id: "recipient", name: "Nas", email: "nas@example.test" }],
    groups: [],
    groupPermissions: {},
    userPermissions: { "nas@example.test": "edit" },
    enabled: true,
    is_shared: true,
  };
  access.mockResolvedValue(stored);
  setEnabled.mockResolvedValue({ ...stored, enabled: false, is_shared: false });
  show();
  await userEvent.click(await screen.findByRole("switch", { name: "sharing_enabled" }));
  await waitFor(() => expect(setEnabled).toHaveBeenCalledWith("subscription-1", false));
  expect(await screen.findByRole("switch", { name: "sharing_disabled" })).not.toBeChecked();
  expect(screen.getByRole("button", { name: "nas@example.test" })).toBeDisabled();
  expect(saveAccess).not.toHaveBeenCalled();
});
