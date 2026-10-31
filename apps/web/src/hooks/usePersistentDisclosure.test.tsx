import { act, cleanup, render, renderHook, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ApiKeyEndpointsReference } from "@/components/settings/api-keys/ApiKeyEndpointsReference";
import { PersistentDetails } from "@/components/ui/persistent-details";
import { usePersistentDisclosure, usePersistentExpandedItems } from "@/hooks/usePersistentDisclosure";
import { LS_KEYS } from "@/lib/constants";

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

beforeEach(() => { localStorage.clear(); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

function Guide({ userId = "first" }: { userId?: string }) {
  return <PersistentDetails userId={userId} preference="notifications.variables.email" defaultOpen>
    <summary>Template variables</summary><p>Guide content</p>
  </PersistentDetails>;
}

it("keeps the template variable help closed after remounting instead of restoring defaultOpen", async () => {
  const first = render(<Guide />);
  await userEvent.click(screen.getByText("Template variables"));
  await waitFor(() => expect(localStorage.getItem(LS_KEYS.disclosure("first", "notifications.variables.email"))).toBe("false"));
  first.unmount();
  render(<Guide />);
  expect(screen.getByText("Template variables").closest("details")).not.toHaveAttribute("open");
});

it("keeps the guide open after reopening it and remounting", async () => {
  localStorage.setItem(LS_KEYS.disclosure("first", "notifications.variables.email"), "false");
  const first = render(<Guide />);
  await userEvent.click(screen.getByText("Template variables"));
  await waitFor(() => expect(localStorage.getItem(LS_KEYS.disclosure("first", "notifications.variables.email"))).toBe("true"));
  first.unmount();
  render(<Guide />);
  expect(screen.getByText("Template variables").closest("details")).toHaveAttribute("open");
});

it("does not reopen the guide on unrelated renders or overwrite another account's choice", async () => {
  const view = render(<Guide />);
  await userEvent.click(screen.getByText("Template variables"));
  await waitFor(() => expect(localStorage.getItem(LS_KEYS.disclosure("first", "notifications.variables.email"))).toBe("false"));
  view.rerender(<Guide />);
  expect(screen.getByText("Template variables").closest("details")).not.toHaveAttribute("open");
  view.rerender(<Guide userId="second" />);
  expect(screen.getByText("Template variables").closest("details")).toHaveAttribute("open");
  view.rerender(<Guide userId="first" />);
  expect(screen.getByText("Template variables").closest("details")).not.toHaveAttribute("open");
  expect(localStorage.getItem(LS_KEYS.disclosure("second", "notifications.variables.email"))).toBeNull();
});

it("isolates accounts, logout and login without inheriting an in-memory disclosure", () => {
  const hook = renderHook(({ userId }) => usePersistentDisclosure(userId, "sidebar"), {
    initialProps: { userId: "first" as string | undefined },
  });
  act(() => hook.result.current[1](true));
  hook.rerender({ userId: "second" });
  expect(hook.result.current[0]).toBe(false);
  act(() => hook.result.current[1](false));
  hook.rerender({ userId: undefined });
  expect(hook.result.current[0]).toBe(false);
  hook.rerender({ userId: "first" });
  expect(hook.result.current[0]).toBe(true);
});

it.each(["invalid json", "null", '"false"', "{}", "[]"])("ignores invalid boolean preferences: %s", (stored) => {
  localStorage.setItem(LS_KEYS.disclosure("first", "guide"), stored);
  const hook = renderHook(() => usePersistentDisclosure("first", "guide", true));
  expect(hook.result.current[0]).toBe(true);
  expect(localStorage.getItem(LS_KEYS.disclosure("first", "guide"))).toBe(stored);
});

it("keeps in-memory toggling usable when storage cannot be read or written", () => {
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("full"); });
  const hook = renderHook(() => usePersistentDisclosure("first", "guide", true));
  act(() => hook.result.current[1](false));
  expect(hook.result.current[0]).toBe(false);
});

it("preserves batched expanded items, closes individual items and restores them per account", () => {
  const hook = renderHook(({ userId }) => usePersistentExpandedItems(userId, "statistics.categories"), {
    initialProps: { userId: "first" },
  });
  act(() => { hook.result.current[1]("category-a"); hook.result.current[1]("category-b"); });
  expect([...hook.result.current[0]]).toEqual(["category-a", "category-b"]);
  act(() => hook.result.current[1]("category-a"));
  hook.rerender({ userId: "second" });
  expect([...hook.result.current[0]]).toEqual([]);
  hook.rerender({ userId: "first" });
  expect([...hook.result.current[0]]).toEqual(["category-b"]);
  hook.unmount();
  const restored = renderHook(() => usePersistentExpandedItems("first", "statistics.categories"));
  expect([...restored.result.current[0]]).toEqual(["category-b"]);
});

it("rejects malformed expanded-item storage", () => {
  localStorage.setItem(LS_KEYS.disclosure("first", "groups"), '["valid", 123]');
  const hook = renderHook(() => usePersistentExpandedItems("first", "groups"));
  expect([...hook.result.current[0]]).toEqual([]);
});

it("restores the actual API reference, group and request schema on remount", async () => {
  const view = render(<ApiKeyEndpointsReference userId="first" />);
  await userEvent.click(screen.getByRole("button", { name: "api_key_endpoints_title" }));
  await userEvent.click(screen.getByRole("button", { name: /^subscriptions/ }));
  await userEvent.click(screen.getAllByRole("button", { name: "api_key_show_body_schema" })[0]);
  view.unmount();
  render(<ApiKeyEndpointsReference userId="first" />);
  expect(screen.getByRole("button", { name: "api_key_endpoints_title" })).toHaveAttribute("aria-expanded", "true");
  expect(screen.getByRole("button", { name: /^subscriptions/ })).toHaveAttribute("aria-expanded", "true");
  expect(screen.getAllByRole("button", { name: "api_key_show_body_schema" })[0]).toHaveAttribute("aria-expanded", "true");
});
