import { act, renderHook, waitFor } from "@testing-library/react";

import { useSubscriptionSort } from "@/hooks/useSubscriptionSort";
import type { User } from "@/types";

import { createQueryClientWrapper } from "../test/query-client";

const mocks = vi.hoisted(() => ({
  user: null as User | null,
  update: vi.fn(),
  refreshUser: vi.fn(),
  error: vi.fn(),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: mocks.user, refreshUser: mocks.refreshUser }),
}));
vi.mock("@/services/users", () => ({ usersService: { update: mocks.update } }));
vi.mock("@/lib/toast", () => ({ toast: { error: mocks.error } }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

const account = (id: string, fields: Partial<User> = {}): User => ({
  id, email: `${id}@example.test`, username: id, name: id,
  sort_order: "name", sort_direction: "asc", ...fields,
});
let persisted: Map<string, User>;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.user = account("first");
  persisted = new Map([["first", { ...mocks.user }]]);
  mocks.update.mockImplementation(async (id: string, data: Partial<User>) => {
    const saved = { ...persisted.get(id)!, ...data };
    persisted.set(id, saved);
    return saved;
  });
  mocks.refreshUser.mockImplementation(async () => {
    mocks.user = { ...persisted.get(mocks.user!.id)! };
  });
});

it("keeps payment-date sorting and direction after saving and reopening the page", async () => {
  const first = renderHook(() => useSubscriptionSort(), { wrapper: createQueryClientWrapper().Wrapper });
  act(() => first.result.current.setSort("date"));
  await waitFor(() => expect(first.result.current.sort).toBe("date"));
  await waitFor(() => expect(first.result.current.isSaving).toBe(false));
  expect(mocks.update).toHaveBeenCalledWith("first", { sort_order: "next_payment", sort_direction: "asc" });
  act(() => first.result.current.toggleSortDir());
  await waitFor(() => expect(first.result.current.sortDir).toBe("desc"));
  await waitFor(() => expect(first.result.current.isSaving).toBe(false));
  first.unmount();

  // Authentication on reload supplies the saved server record, not the old component state.
  mocks.user = { ...persisted.get("first")! };
  const reopened = renderHook(() => useSubscriptionSort(), { wrapper: createQueryClientWrapper().Wrapper });
  expect(reopened.result.current.sort).toBe("date");
  expect(reopened.result.current.sortDir).toBe("desc");
});

it("reads each account's own preference and persists status sorting", async () => {
  const hook = renderHook(() => useSubscriptionSort(), { wrapper: createQueryClientWrapper().Wrapper });
  mocks.user = account("second", { sort_order: "price", sort_direction: "desc" });
  persisted.set("second", { ...mocks.user });
  hook.rerender();
  expect(hook.result.current.sort).toBe("price");
  expect(hook.result.current.sortDir).toBe("desc");
  act(() => hook.result.current.setSort("status"));
  await waitFor(() => expect(hook.result.current.sort).toBe("status"));
  expect(mocks.update).toHaveBeenCalledWith("second", { sort_order: "status", sort_direction: "desc" });
  expect(persisted.get("first")?.sort_order).toBe("name");
});

it("restores the account preference after logout and login", async () => {
  const first = renderHook(() => useSubscriptionSort(), { wrapper: createQueryClientWrapper().Wrapper });
  act(() => first.result.current.setSort("date"));
  await waitFor(() => expect(first.result.current.sort).toBe("date"));
  await waitFor(() => expect(first.result.current.isSaving).toBe(false));
  act(() => first.result.current.toggleSortDir());
  await waitFor(() => expect(first.result.current.sortDir).toBe("desc"));
  first.unmount();
  mocks.user = null;
  const loggedOut = renderHook(() => useSubscriptionSort(), { wrapper: createQueryClientWrapper().Wrapper });
  expect(loggedOut.result.current.sort).toBe("name");
  loggedOut.unmount();
  mocks.user = { ...persisted.get("first")! };
  const loggedIn = renderHook(() => useSubscriptionSort(), { wrapper: createQueryClientWrapper().Wrapper });
  expect(loggedIn.result.current.sort).toBe("date");
  expect(loggedIn.result.current.sortDir).toBe("desc");
});

it("keeps the saved selection and reports a failed save", async () => {
  mocks.update.mockRejectedValueOnce(new Error("Offline"));
  const hook = renderHook(() => useSubscriptionSort(), { wrapper: createQueryClientWrapper().Wrapper });
  act(() => hook.result.current.setSort("date"));
  await waitFor(() => expect(mocks.error).toHaveBeenCalledWith("error_saving"));
  expect(hook.result.current.sort).toBe("name");
  expect(hook.result.current.sortDir).toBe("asc");
  expect(mocks.refreshUser).not.toHaveBeenCalled();
});

it("prevents overlapping preference writes while the first save is pending", async () => {
  let finish!: () => void;
  mocks.update.mockImplementationOnce((id: string, fields: Partial<User>) => new Promise<User>((resolve) => {
    finish = () => {
      const saved = { ...persisted.get(id)!, ...fields };
      persisted.set(id, saved);
      resolve(saved);
    };
  }));
  const hook = renderHook(() => useSubscriptionSort(), { wrapper: createQueryClientWrapper().Wrapper });
  act(() => hook.result.current.setSort("date"));
  await waitFor(() => expect(hook.result.current.isSaving).toBe(true));
  act(() => hook.result.current.toggleSortDir());
  expect(mocks.update).toHaveBeenCalledTimes(1);
  await act(async () => finish());
  await waitFor(() => expect(hook.result.current.sort).toBe("date"));
  expect(hook.result.current.sortDir).toBe("asc");
});
