import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FinanceAnimationIcon } from "@/components/FinanceAnimationIcon";
import { DisplayTab } from "@/components/settings/display/DisplayTab";
import { ThemeTab } from "@/components/settings/theme/ThemeTab";
import { buildColorCSS, getPreset } from "@/lib/color-presets";

const state = vi.hoisted(() => ({ user: { id: "appearance-user" } as Record<string, unknown>, mutate: vi.fn() }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: state.user }) }));
vi.mock("@/components/settings/shared/useUserSettingsMutation", () => ({
  useUserSettingsMutation: () => ({ mutate: state.mutate, isPending: false }),
}));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

beforeEach(() => {
  state.user = { id: "appearance-user" };
  state.mutate.mockClear();
  document.documentElement.classList.remove("dark");
  document.getElementById("color-theme")?.remove();
});
afterEach(() => vi.restoreAllMocks());

describe("animation display preferences", () => {
  it("keeps existing accounts on three-play animations by default", () => {
    const { container } = render(<FinanceAnimationIcon asset="receipt" fallback={<span>original</span>} />);
    expect(container.querySelector("img")?.src).toContain("savings-receipt.gif?plays=3");
    expect(container.querySelector("source")?.srcset).toContain("savings-receipt-216.webp");
    expect(screen.queryByText("original")).toBeNull();
  });
  it("renders only the original icon when GIFs are disabled", () => {
    state.user.disable_gifs = true;
    const { container } = render(<FinanceAnimationIcon asset="receipt" fallback={<span>original</span>} />);
    expect(screen.getByText("original")).toBeInTheDocument();
    expect(container.querySelector("picture, img, source")).toBeNull();
  });
  it("uses infinite variants for both image formats", () => {
    state.user.loop_gifs = true;
    const { container } = render(<FinanceAnimationIcon asset="receipt" fallback={null} />);
    expect(container.querySelector("img")?.src).toContain("savings-receipt-loop.gif?plays=infinite");
    expect(container.querySelector("source")?.srcset).toContain("savings-receipt-216-loop.webp");
  });
  it("does not restart an animation on unrelated rerenders", () => {
    const icon = <FinanceAnimationIcon asset="receipt" fallback={null} />;
    const { container, rerender } = render(icon);
    const previous = container.querySelector("img")?.src;
    state.user.name = "Changed name";
    rerender(<FinanceAnimationIcon asset="receipt" fallback={null} />);
    expect(container.querySelector("img")?.src).toBe(previous);
  });
  it("restarts when re-enabled or switching back to finite playback even within one millisecond", () => {
    vi.spyOn(Date, "now").mockReturnValue(123456789);
    const { container, rerender } = render(<FinanceAnimationIcon asset="receipt" fallback={null} />);
    const first = container.querySelector("img")?.src;
    state.user.disable_gifs = true;
    rerender(<FinanceAnimationIcon asset="receipt" fallback={null} />);
    state.user.disable_gifs = false;
    rerender(<FinanceAnimationIcon asset="receipt" fallback={null} />);
    const second = container.querySelector("img")?.src;
    expect(second).not.toBe(first);
    state.user.loop_gifs = true;
    rerender(<FinanceAnimationIcon asset="receipt" fallback={null} />);
    state.user.loop_gifs = false;
    rerender(<FinanceAnimationIcon asset="receipt" fallback={null} />);
    expect(container.querySelector("img")?.src).not.toBe(second);
    expect(container.querySelector("img")?.src).toContain("?plays=3");
  });
  it("shows GIFs enabled and continuous playback disabled for existing accounts", () => {
    render(<DisplayTab />);
    expect(screen.getByRole("switch", { name: "use_gifs" })).toBeChecked();
    expect(screen.getByRole("switch", { name: "loop_gifs" })).not.toBeChecked();
  });
  it("persists the GIF toggle through the user settings mutation", () => {
    render(<DisplayTab />);
    fireEvent.click(screen.getByRole("switch", { name: "use_gifs" }));
    expect(state.mutate).toHaveBeenCalledWith({ disable_gifs: true });
  });
  it("hides the nested playback control while GIFs are disabled", () => {
    state.user = { id: "appearance-user", disable_gifs: true, loop_gifs: true };
    render(<DisplayTab />);
    expect(screen.queryByRole("switch", { name: "loop_gifs" })).toBeNull();
    fireEvent.click(screen.getByRole("switch", { name: "use_gifs" }));
    expect(state.mutate).toHaveBeenCalledWith({ disable_gifs: false });
  });
  it("saves continuous playback without changing GIF visibility", () => {
    render(<DisplayTab />);
    fireEvent.click(screen.getByRole("switch", { name: "loop_gifs" }));
    expect(state.mutate).toHaveBeenCalledWith({ loop_gifs: true });
  });
});

describe("Champagne theme", () => {
  it("selects and saves the complete dark palette from light mode", () => {
    state.user.dark_theme_mode = 0;
    render(<ThemeTab />);
    fireEvent.click(screen.getByText("Champagne"));
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(state.mutate).toHaveBeenCalledWith({ color_theme: "champagne", dark_theme_mode: 1 });
    const styles = getComputedStyle(document.documentElement);
    expect(styles.getPropertyValue("--background").trim()).toBe("218.181818 20% 10.784314%");
    expect(styles.getPropertyValue("--primary").trim()).toBe("41.052632 73.643411% 74.705882%");
  });
  it("removes the custom surfaces when a different accent preset is applied", () => {
    const element = document.createElement("style");
    element.id = "color-theme";
    document.head.appendChild(element);
    element.textContent = buildColorCSS(getPreset("champagne"));
    expect(element.textContent).toContain("--background:");
    element.textContent = buildColorCSS(getPreset("monline"));
    expect(element.textContent).not.toContain("--background:");
    expect(element.textContent).not.toContain("--amount-marker-background:");
  });
});
