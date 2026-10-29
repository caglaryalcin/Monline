import "@testing-library/jest-dom";

// jsdom does not implement layout observers used by Radix switches and menus.
vi.stubGlobal(
  "ResizeObserver",
  class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);
