import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { ProfileTab } from "@/components/settings/profile/ProfileTab";
import i18n from "@/lib/i18n";

const mocks = vi.hoisted(() => ({ update: vi.fn(), refresh: vi.fn(), user: { id: "owner", name: "Owner", username: "owner", email: "owner@example.test", language: "en", number_locale: "", budget: 0 } }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: mocks.user, refreshUser: mocks.refresh, isAdmin: false }) }));
vi.mock("@/services/users", () => ({ usersService: { update: mocks.update, avatarUrl: () => null } }));
vi.mock("@/services/currencies", () => ({ currenciesService: { listMain: async () => [] } }));
vi.mock("@/lib/toast", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const clients: QueryClient[] = [];
function show() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  clients.push(client);
  render(<QueryClientProvider client={client}><ProfileTab /></QueryClientProvider>);
}
beforeEach(async () => {
  await i18n.changeLanguage("en");
  mocks.user.number_locale = "";
  mocks.update.mockReset().mockResolvedValue(mocks.user);
  mocks.refresh.mockReset().mockResolvedValue(undefined);
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
  Element.prototype.scrollIntoView = () => {};
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
});
afterEach(() => { cleanup(); clients.splice(0).forEach(client => client.clear()); vi.unstubAllGlobals(); });

it("saves a number format independently of the interface language", async () => {
  show(); const user = userEvent.setup();
  await user.click(screen.getByRole("combobox", { name: "Number format" }));
  await user.click(screen.getByRole("option", { name: "123.456,78" }));
  await user.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() => expect(mocks.update).toHaveBeenCalledOnce());
  const [id, body] = mocks.update.mock.calls[0];
  expect(id).toBe("owner");
  expect(body.get("number_locale")).toBe("de-DE");
  expect(body.get("language")).toBe("en");
  expect(mocks.refresh).toHaveBeenCalledOnce();
});

it("restores the saved preference and can switch back to the browser default", async () => {
  mocks.user.number_locale = "de-CH";
  show(); const user = userEvent.setup();
  const select = screen.getByRole("combobox", { name: "Number format" });
  expect(select).toHaveTextContent(new Intl.NumberFormat("de-CH", { minimumFractionDigits: 2 }).format(123456.78));
  await user.click(select);
  await user.click(screen.getByRole("option", { name: /^Browser settings/ }));
  await user.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() => expect(mocks.update).toHaveBeenCalledOnce());
  expect(mocks.update.mock.calls[0][1].get("number_locale")).toBe("");
});
