export const FINANCE_PATHS = ["/finance", "/debt", "/savings", "/statements"] as const;

export function isFinanceWorkspace(pathname: string) {
  return FINANCE_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

export const FINANCE_SECTIONS = [
  { key: "overview", path: "/finance/overview" },
  { key: "ledger", path: "/finance" },
  { key: "debts", path: "/debt" },
  { key: "savings", path: "/savings" },
] as const;

export function financeWorkspaceSection(pathname: string) {
  if (pathname.startsWith("/statements")) return "debts";
  return FINANCE_SECTIONS.find((section) => section.path === pathname)?.key || "overview";
}
