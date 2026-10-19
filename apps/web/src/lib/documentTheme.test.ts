import { setDocumentTheme } from "./documentTheme";

describe("document theme updates", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.documentElement.classList.remove("dark");
    document.documentElement.removeAttribute("data-theme-changing");
  });

  it("resolves each theme with transitions disabled and immediately restores normal transitions", () => {
    const root = document.documentElement;
    const snapshots: boolean[] = [];
    vi.spyOn(root, "offsetHeight", "get").mockImplementation(() => {
      expect(root).toHaveAttribute("data-theme-changing");
      snapshots.push(root.classList.contains("dark"));
      return 100;
    });
    setDocumentTheme(true);
    expect(root).toHaveClass("dark");
    expect(root).not.toHaveAttribute("data-theme-changing");
    setDocumentTheme(false);
    expect(root).not.toHaveClass("dark");
    expect(root).not.toHaveAttribute("data-theme-changing");
    expect(snapshots).toEqual([true, false]);
  });

  it("does not restart transitions for an unchanged saved preference", () => {
    const layout = vi.spyOn(document.documentElement, "offsetHeight", "get");
    setDocumentTheme(false);
    expect(layout).not.toHaveBeenCalled();
  });
});
