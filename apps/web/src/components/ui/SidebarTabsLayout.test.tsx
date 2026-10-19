import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Settings, Trash2, User } from "lucide-react";

import type { SidebarTabsLayoutItem } from "./SidebarTabsLayout";
import { SidebarTabsLayout } from "./SidebarTabsLayout";

type TabValue = "profile" | "settings" | "danger";

const items: SidebarTabsLayoutItem<TabValue>[] = [
  { value: "profile", label: "Profile", icon: User },
  { value: "settings", label: "Settings", icon: Settings },
  { value: "danger", label: "Delete Account", icon: Trash2, danger: true },
];

describe("SidebarTabsLayout", () => {
  beforeAll(() => {
    Element.prototype.hasPointerCapture = () => false;
    Element.prototype.setPointerCapture = () => {};
    Element.prototype.releasePointerCapture = () => {};
    Element.prototype.scrollIntoView = () => {};
  });
  it("navigates to the selected section using the compact menu", async () => {
    const onValueChange = vi.fn();
    render(
      <SidebarTabsLayout
        title="Account"
        activeValue="profile"
        items={items}
        onValueChange={onValueChange}
      >
        <div />
      </SidebarTabsLayout>,
    );
    await userEvent.click(screen.getByRole("combobox", { name: "Account" }));
    await userEvent.click(screen.getByRole("option", { name: "Settings" }));
    expect(onValueChange).toHaveBeenCalledWith("settings");
  });
  it("renders the title and all nav items", () => {
    render(
      <SidebarTabsLayout
        title="Account"
        activeValue="profile"
        items={items}
        onValueChange={() => {}}
      >
        <div />
      </SidebarTabsLayout>,
    );
    expect(screen.getByRole("navigation", { name: "Account" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Account" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Profile" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Settings" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete Account" })).toBeInTheDocument();
  });

  it("renders children inside the main content area", () => {
    render(
      <SidebarTabsLayout title="T" activeValue="profile" items={items} onValueChange={() => {}}>
        <p>main content here</p>
      </SidebarTabsLayout>,
    );
    expect(screen.getByText("main content here")).toBeInTheDocument();
  });

  it("calls onValueChange with the clicked item value", async () => {
    const onValueChange = vi.fn();
    render(
      <SidebarTabsLayout
        title="T"
        activeValue="profile"
        items={items}
        onValueChange={onValueChange}
      >
        <div />
      </SidebarTabsLayout>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Settings" }));
    expect(onValueChange).toHaveBeenCalledWith("settings");
  });

  it("applies active primary styles to the current non-danger tab", () => {
    render(
      <SidebarTabsLayout title="T" activeValue="profile" items={items} onValueChange={() => {}}>
        <div />
      </SidebarTabsLayout>,
    );
    const activeButton = screen.getByRole("button", { name: "Profile" }).closest("button");
    expect(activeButton).toHaveClass("bg-primary", "text-primary-foreground");
  });

  it("applies destructive styles to the active danger tab", () => {
    render(
      <SidebarTabsLayout title="T" activeValue="danger" items={items} onValueChange={() => {}}>
        <div />
      </SidebarTabsLayout>,
    );
    const dangerButton = screen.getByRole("button", { name: "Delete Account" }).closest("button");
    expect(dangerButton).toHaveClass("bg-destructive/10", "text-destructive");
  });

  it("applies muted styles to inactive tabs", () => {
    render(
      <SidebarTabsLayout title="T" activeValue="profile" items={items} onValueChange={() => {}}>
        <div />
      </SidebarTabsLayout>,
    );
    const inactiveButton = screen.getByRole("button", { name: "Settings" }).closest("button");
    expect(inactiveButton).toHaveClass("text-muted-foreground");
  });
});
