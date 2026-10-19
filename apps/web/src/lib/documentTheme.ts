/** Apply theme colors in one style update, preserving normal hover/motion transitions. */
export function setDocumentTheme(dark: boolean) {
  const root = document.documentElement;
  if (root.classList.contains("dark") === dark) return;
  root.setAttribute("data-theme-changing", "");
  root.classList.toggle("dark", dark);
  // Resolve the new colors before restoring transitions on the same frame.
  void root.offsetHeight;
  root.removeAttribute("data-theme-changing");
}
