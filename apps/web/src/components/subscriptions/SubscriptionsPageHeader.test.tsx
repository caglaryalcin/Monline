import { fireEvent, render, screen } from "@testing-library/react";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

import { SubscriptionsPageHeader } from "./SubscriptionsPageHeader";

describe("SubscriptionsPageHeader", () => {
  it("triggers the create action", () => {
    const onCreate = vi.fn();
    render(<SubscriptionsPageHeader onCreate={onCreate} />);
    fireEvent.click(screen.getByRole("button", { name: "add_subscription" }));
    expect(onCreate).toHaveBeenCalledTimes(1);
  });
});
