import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

import { SubscriptionsToolbar } from "./SubscriptionsToolbar";

describe("SubscriptionsToolbar", () => {
  it("renders the controls and delegates interactions", async () => {
    const user = userEvent.setup();
    const onSearchChange = vi.fn();
    const onToggleFilters = vi.fn();
    const onCycleSort = vi.fn();
    const onSortChange = vi.fn();
    const onViewChange = vi.fn();

    render(
      <SubscriptionsToolbar
        searchTerm="net"
        showFilters={false}
        view="grid"
        sort="name"
        sortDir="asc"
        onSortChange={onSortChange}
        onSearchChange={onSearchChange}
        onToggleFilters={onToggleFilters}
        onCycleSort={onCycleSort}
        onViewChange={onViewChange}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText("search..."), {
      target: { value: "spotify" },
    });
    fireEvent.click(screen.getByRole("button", { name: "filter" }));
    await user.click(screen.getByRole("button", { name: "sort" }));
    await user.click(screen.getByRole("menuitemradio", { name: "next_payment" }));
    await user.click(screen.getByRole("button", { name: "sort" }));
    await user.click(screen.getByRole("menuitemradio", { name: "sort_descending" }));
    fireEvent.click(screen.getByRole("button", { name: "list_view" }));
    fireEvent.click(screen.getByRole("button", { name: "grid_view" }));

    expect(onSearchChange).toHaveBeenCalledWith("spotify");
    expect(onToggleFilters).toHaveBeenCalledTimes(1);
    expect(onCycleSort).toHaveBeenCalledTimes(1);
    expect(onSortChange).toHaveBeenCalledWith("date");
    expect(onViewChange).toHaveBeenCalledWith("list");
    expect(onViewChange).toHaveBeenCalledWith("grid");
    expect(screen.getByRole("button", { name: "grid_view" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("applies active styling to filter button when showFilters is true", () => {
    const { container } = render(
      <SubscriptionsToolbar
        searchTerm=""
        showFilters={true}
        view="list"
        sort="name"
        sortDir="asc"
        onSortChange={vi.fn()}
        onSearchChange={vi.fn()}
        onToggleFilters={vi.fn()}
        onCycleSort={vi.fn()}
        onViewChange={vi.fn()}
      />,
    );

    const filterButton = screen.getByRole("button", { name: "filter" });
    expect(filterButton.className).toContain("border-border");
    expect(filterButton.className).toContain("bg-accent");

    // The Filter icon inside should have text-primary class
    const filterIcon = container.querySelector(".text-primary");
    expect(filterIcon).toBeInTheDocument();
  });
});
