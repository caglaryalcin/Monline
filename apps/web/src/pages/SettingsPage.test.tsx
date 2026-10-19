import { fireEvent, render, screen } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  useSearch: vi.fn(() => ({ tab: "theme" })),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mocks.navigate,
}));

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ isAdmin: false }) }));

vi.mock("@/routes", () => ({
  settingsRoute: {
    useSearch: mocks.useSearch,
  },
}));

vi.mock("@/components/settings/settingsPage.config", () => ({
  SERVER_SETTINGS_TABS: ["oidc", "maintenance"],
  SETTINGS_TAB_COMPONENTS: {
    profile: () => <div>Profile Tab</div>,
    theme: () => <div>Theme Tab</div>,
    display: () => <div>Theme Tab</div>,
    notifications: () => <div>Notifications Tab</div>,
    security: () => <div>Security Tab</div>,
  },
  getSettingsPageMenuItems: () => [
    { value: "profile", label: "Profile" },
    { value: "theme", label: "Theme" },
  ],
}));

vi.mock("@/components/ui/SidebarTabsLayout", () => ({
  SidebarTabsLayout: ({
    title,
    items,
    activeValue,
    onValueChange,
    children,
  }: {
    title: string;
    items: Array<{ value: string; label: string }>;
    activeValue: string;
    onValueChange: (value: "profile" | "theme") => void;
    children: React.ReactNode;
  }) => (
    <div>
      <h1>{title}</h1>
      <div data-testid="active-tab">{activeValue}</div>
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          onClick={() => onValueChange(item.value as "profile" | "theme")}
        >
          {item.label}
        </button>
      ))}
      {children}
    </div>
  ),
}));

import { SettingsPage } from "./SettingsPage";

describe("SettingsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useSearch.mockReturnValue({ tab: "theme" });
  });

  it("renders the selected settings tab and changes tabs through router navigation", () => {
    render(<SettingsPage />);

    expect(screen.getByText("settings")).toBeInTheDocument();
    expect(screen.getByTestId("active-tab")).toHaveTextContent("display");
    expect(screen.getByText("Theme Tab")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Profile" }));

    expect(mocks.navigate).toHaveBeenCalledWith({
      to: "/settings",
      search: { tab: "profile" },
      replace: true,
    });
  });

  it("defaults to profile tab when search.tab is undefined or invalid", () => {
    // 1. undefined tab
    mocks.useSearch.mockReturnValue({} as any);
    const { rerender } = render(<SettingsPage />);
    expect(screen.getByTestId("active-tab")).toHaveTextContent("profile");
    expect(screen.getByText("Profile Tab")).toBeInTheDocument();

    // 2. invalid tab
    mocks.useSearch.mockReturnValue({ tab: "invalid_tab" });
    rerender(<SettingsPage />);
    expect(screen.getByTestId("active-tab")).toHaveTextContent("invalid_tab");
    expect(screen.getByText("Profile Tab")).toBeInTheDocument();
  });
  it.each([
    ["smtp", "notifications", "Notifications Tab"],
    ["registration", "security", "Security Tab"],
  ])("opens the merged destination for the old %s link", (tab, destination, content) => {
    mocks.useSearch.mockReturnValue({ tab });
    render(<SettingsPage />);
    expect(screen.getByTestId("active-tab")).toHaveTextContent(destination);
    expect(screen.getByText(content)).toBeInTheDocument();
  });
});
