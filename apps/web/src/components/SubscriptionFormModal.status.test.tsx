import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { queryKeys } from "@/lib/queryKeys";
import { createQueryClientWrapper } from "@/test/query-client";

import { SubscriptionFormModal } from "./SubscriptionFormModal";

const mocks = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: "tr" } }),
}));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: {} }) }));
vi.mock("@/hooks/useLogoSearch", () => ({
  useLogoSearch: () => ({ logoUrl: "", logoPreview: null, resolveLogoFile: async () => null }),
}));
vi.mock("@/components/SubscriptionLogo", () => ({ SubscriptionLogo: () => null }));
vi.mock("@/components/SubscriptionLogoSection", () => ({ SubscriptionLogoSection: () => null }));
vi.mock("@/services/subscriptions", () => ({ subscriptionsService: { create: mocks.create } }));
vi.mock("@/lib/toast", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

describe("new subscription status switches", () => {
  beforeEach(() => {
    Element.prototype.hasPointerCapture = () => false;
    Element.prototype.setPointerCapture = () => {};
    Element.prototype.releasePointerCapture = () => {};
    Element.prototype.scrollIntoView = () => {};
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    mocks.create.mockReset().mockResolvedValue({ id: "new-sub" });
  });
  afterEach(() => vi.unstubAllGlobals());

  it.each([false, true])(
    "switches exclusively through labels and saves inactive=%s",
    async (inactive) => {
      const { client, Wrapper } = createQueryClientWrapper();
      client.setQueryData(queryKeys.cycles(), [{ id: "monthly", name: "Monthly" }]);
      const saved = vi.fn();
      render(
        <SubscriptionFormModal
          sub={null}
          userId="user-1"
          currencies={[
            {
              id: "try",
              code: "TRY",
              name: "Turkish Lira",
              symbol: "₺",
              rate: 1,
              is_main: true,
              user: "user-1",
            },
          ]}
          categories={[{ id: "cat-1", name: "AI", user: "user-1" }]}
          paymentMethods={[]}
          household={[]}
          onClose={vi.fn()}
          onSaved={saved}
        />,
        { wrapper: Wrapper },
      );
      const autoRenew = screen.getByRole("switch", { name: "auto_renew" });
      const paused = screen.getByRole("switch", { name: "inactive" });
      expect(autoRenew).toBeChecked();
      expect(paused).not.toBeChecked();
      await userEvent.click(screen.getByText("inactive", { selector: "label" }));
      expect(paused).toBeChecked();
      expect(autoRenew).not.toBeChecked();
      await userEvent.click(screen.getByText("auto_renew", { selector: "label" }));
      expect(autoRenew).toBeChecked();
      expect(paused).not.toBeChecked();
      if (inactive) await userEvent.click(paused);
      fireEvent.change(screen.getByLabelText(/name/), { target: { value: "Status test" } });
      fireEvent.change(screen.getByLabelText(/price/), { target: { value: "25" } });
      await userEvent.click(screen.getByRole("combobox", { name: "category" }));
      await userEvent.click(screen.getByRole("option", { name: "AI" }));
      await userEvent.click(screen.getByRole("button", { name: "save" }));
      await waitFor(() => expect(saved).toHaveBeenCalledOnce());
      expect(mocks.create).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({
          inactive,
          auto_renew: !inactive,
        }),
      );
    },
  );
});
