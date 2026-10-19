import { act, fireEvent, render, screen } from "@testing-library/react";

import { ThemeToggle } from "./ThemeToggle";

const mocks = vi.hoisted(() => ({ mutate: vi.fn(), isPending: false, error: vi.fn() }));
vi.mock("@/components/settings/shared/useUserSettingsMutation", () => ({
  useUserSettingsMutation: () => mocks,
}));
vi.mock("@/lib/toast", () => ({ toast: { error: mocks.error } }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

describe("header theme control", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.documentElement.classList.remove("dark");
    mocks.isPending = false;
  });
  afterEach(() => document.documentElement.classList.remove("dark"));

  it("applies and saves the explicit theme in both directions", () => {
    render(<ThemeToggle />);
    fireEvent.click(screen.getByRole("button", { name: "switch_to_dark" }));
    expect(document.documentElement).toHaveClass("dark");
    expect(mocks.mutate).toHaveBeenLastCalledWith({ dark_theme_mode: 1 }, expect.any(Object));
    fireEvent.click(screen.getByRole("button", { name: "switch_to_light" }));
    expect(document.documentElement).not.toHaveClass("dark");
    expect(mocks.mutate).toHaveBeenLastCalledWith({ dark_theme_mode: 0 }, expect.any(Object));
  });

  it("restores the previous theme when saving fails", () => {
    mocks.mutate.mockImplementationOnce((_data, callbacks) => callbacks.onError());
    render(<ThemeToggle />);
    fireEvent.click(screen.getByRole("button", { name: "switch_to_dark" }));
    expect(document.documentElement).not.toHaveClass("dark");
    expect(screen.getByRole("button", { name: "switch_to_dark" })).toBeInTheDocument();
    expect(mocks.error).toHaveBeenCalledWith("theme_save_error");
  });

  it("follows theme changes from settings and prevents changes during a save", async () => {
    mocks.isPending = true;
    render(<ThemeToggle />);
    await act(async () => {
      document.documentElement.classList.add("dark");
    });
    expect(screen.getByRole("button", { name: "switch_to_light" })).toBeDisabled();
  });
});
