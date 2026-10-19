vi.mock("@/hooks/useAppUpdate", () => ({ useAppUpdate: () => null }));
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";

import type { User } from "@/types";

const mocks = vi.hoisted(() => ({
  pathname: "/dashboard",
  logout: vi.fn(),
  isAdmin: true,
  user: {
    id: "u",
    name: "Monline User",
    email: "user@example.com",
    username: "user",
    mobile_navigation: true,
  } as User,
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "en", resolvedLanguage: "en" },
  }),
}));
vi.mock("@tanstack/react-router", async () => {
  const { forwardRef } = await import("react");
  return {
    Link: forwardRef<HTMLAnchorElement, { to: string; search?: unknown } & ComponentProps<"a">>(
      ({ to, search: _search, ...props }, ref) => <a href={to} ref={ref} {...props} />,
    ),
    Outlet: () => <div>page-content</div>,
    useRouterState: ({
      select,
    }: {
      select: (state: { location: { pathname: string } }) => string;
    }) => select({ location: { pathname: mocks.pathname } }),
  };
});
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => mocks }));
vi.mock("@/services/users", () => ({ usersService: { avatarUrl: () => null } }));
vi.mock("@/components/ThemeToggle", () => ({ ThemeToggle: () => <button>theme-toggle</button> }));
vi.mock("@/hooks/useSummaryData", () => ({ useSummaryData: () => ({ data: { count: 6 } }) }));
import { Layout } from "./Layout";

describe("Monline navigation", () => {
  beforeEach(() => {
    mocks.isAdmin = true;
    mocks.logout.mockClear();
  });
  it("keeps the core navigation and groups account actions in the header profile menu", async () => {
    const { container } = render(<Layout />);
    expect(screen.getAllByRole("link", { name: "subscriptions" })).toHaveLength(1);
    expect(screen.queryByRole("link", { name: /chat|assistant/i })).not.toBeInTheDocument();
    expect(screen.getByText("page-content")).toBeInTheDocument();
    for (const logo of screen.getAllByRole("link", { name: "go_home" }))
      expect(logo).toHaveAttribute("href", "/dashboard");
    expect(screen.getByRole("banner")).toContainElement(
      screen.getByRole("button", { name: "theme-toggle" }),
    );
    expect(screen.getByRole("link", { name: "active_subscriptions: 6" })).toHaveAttribute(
      "href",
      "/subscriptions",
    );
    expect(container.querySelector("aside")).not.toHaveTextContent("user@example.com");
    expect(screen.queryByText("settings")).not.toBeInTheDocument();
    expect(screen.queryByText("admin")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "profile_menu" }));
    expect(screen.getByRole("menuitem", { name: "settings" })).toHaveAttribute("href", "/settings");
    expect(screen.queryByRole("menuitem", { name: "admin" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("menuitem", { name: "logout" }));
    expect(mocks.logout).toHaveBeenCalledOnce();
  });
  it("exposes an accessible collapse control and hides admin for regular users", async () => {
    mocks.isAdmin = false;
    render(<Layout />);
    await userEvent.click(screen.getByRole("button", { name: "profile_menu" }));
    expect(screen.queryByRole("menuitem", { name: "admin" })).not.toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "settings" })).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "collapse_sidebar" }));
    expect(screen.getByRole("button", { name: "expand_sidebar" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });
  it("closes the mobile menu when a destination is selected", () => {
    const { container } = render(<Layout />);
    fireEvent.click(screen.getByRole("button", { name: "open_menu" }));
    expect(container.querySelector(".fixed.inset-0.z-40")).not.toBeNull();
    fireEvent.click(screen.getAllByRole("link", { name: "dashboard" })[0]);
    expect(container.querySelector(".fixed.inset-0.z-40")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "open_menu" }));
    const about = screen.getByRole("link", { name: "project_about" });
    expect(about).toHaveAttribute("href", "/about");
    fireEvent.click(about);
    expect(container.querySelector(".fixed.inset-0.z-40")).toBeNull();
  });
  it("ignores the retired bottom navigation preference and dismisses the menu with Escape", async () => {
    const { container } = render(<Layout />);
    expect(container.querySelector("nav.fixed.bottom-0")).toBeNull();
    expect(screen.getByRole("main")).not.toHaveClass("pb-24");
    const trigger = screen.getByRole("button", { name: "open_menu" });
    await userEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    await userEvent.keyboard("{Escape}");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveFocus();
  });
});
