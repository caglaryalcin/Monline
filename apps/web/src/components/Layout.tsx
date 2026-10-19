import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import {
  ArrowDownUp,
  BarChart2,
  Calendar,
  CreditCard,
  FileText,
  LayoutDashboard,
  Menu,
  X,
} from "lucide-react";
import { type CSSProperties, Suspense, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { LogoIcon, LogoWithName } from "@/components/AppLogo";
import { PageLoading } from "@/components/PageLoading";
import { ProfileMenu } from "@/components/ProfileMenu";
import { SidebarFooter } from "@/components/SidebarFooter";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/contexts/AuthContext";
import { useLocalToday } from "@/hooks/useLocalToday";
import { useSidebarResize } from "@/hooks/useSidebarResize";
import { useSummaryData } from "@/hooks/useSummaryData";
import { cn } from "@/lib/utils";

const baseNavItems = [
  { key: "dashboard", path: "/dashboard" as const, icon: LayoutDashboard },
  { key: "subscriptions", path: "/subscriptions" as const, icon: CreditCard },
  { key: "calendar", path: "/calendar" as const, icon: Calendar },
  { key: "statistics", path: "/statistics" as const, icon: BarChart2 },
  { key: "bank_statements", path: "/statements" as const, icon: FileText },
  { key: "data_transfer", path: "/data-transfer" as const, icon: ArrowDownUp },
];

export function Layout() {
  const { t, i18n } = useTranslation();
  const today = useLocalToday();
  const [year, month, day] = today.split("-").map(Number);
  const todayLabel = new Intl.DateTimeFormat(
    (i18n.resolvedLanguage || i18n.language || "en").replace(/_/g, "-"),
    { day: "numeric", month: "long", year: "numeric" },
  ).format(new Date(year, month - 1, day));
  const { user } = useAuth();
  const summary = useSummaryData(user?.id ?? "");
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const sidebar = useSidebarResize();
  const menuButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!sidebarOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSidebarOpen(false);
        menuButton.current?.focus();
      }
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [sidebarOpen]);

  const navItems = baseNavItems;

  return (
    <div
      className={cn(
        "monline-app flex h-dvh w-full bg-background text-foreground overflow-hidden",
        isCollapsed && "monline-sidebar-collapsed",
      )}
      style={
        {
          "--monline-sidebar-width": `${sidebar.width}px`,
        } as CSSProperties
      }
    >
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm lg:hidden transition-all duration-300"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        id="monline-sidebar"
        className={cn(
          "monline-sidebar fixed left-0 top-0 z-50 h-full max-w-[85vw] flex flex-col transform border-r border-border transition-[width,transform] duration-300 ease-in-out lg:relative lg:visible lg:pointer-events-auto lg:translate-x-0 lg:z-10 shrink-0",
          sidebarOpen
            ? "visible translate-x-0 shadow-premium w-[260px]"
            : "invisible pointer-events-none -translate-x-full w-[260px]",
          sidebar.resizing && "transition-none",
        )}
      >
        <div className="flex h-full flex-col">
          {/* Logo Area */}
          <div className="relative flex h-[var(--monline-header-height)] shrink-0 items-center justify-between border-b border-border px-4 pt-2">
            <Link
              to="/dashboard"
              aria-label={t("go_home")}
              onClick={() => setSidebarOpen(false)}
              className={cn(
                "flex min-w-0 flex-1 items-center rounded-lg py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring",
                isCollapsed ? "px-2 lg:justify-center lg:px-0" : "px-2",
              )}
            >
              {isCollapsed ? (
                <>
                  <LogoIcon className="hidden h-8 w-8 lg:block" />
                  <LogoWithName className="h-8 w-auto lg:hidden" />
                </>
              ) : (
                <LogoWithName className="h-8 w-auto" />
              )}
            </Link>

            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden text-muted-foreground shrink-0"
              onClick={() => setSidebarOpen(false)}
              aria-label={t("close_menu")}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Desktop collapse toggle */}
          <button
            type="button"
            onClick={() => {
              sidebar.cancelResize();
              setIsCollapsed(!isCollapsed);
            }}
            aria-label={t(isCollapsed ? "expand_sidebar" : "collapse_sidebar")}
            title={t(isCollapsed ? "expand_sidebar" : "collapse_sidebar")}
            aria-controls="monline-sidebar"
            aria-expanded={!isCollapsed}
            className="monline-sidebar-toggle"
          >
            <svg
              className="monline-sidebar-toggle-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              focusable="false"
            >
              <path d="m14 6-6 6 6 6" />
            </svg>
          </button>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto px-3 py-6 space-y-2 overflow-x-hidden">
            <TooltipProvider delayDuration={0}>
              {navItems.map(({ key, path, icon: Icon }) => {
                const isActive = pathname.startsWith(path);
                return (
                  <Tooltip key={key} delayDuration={0}>
                    <TooltipTrigger asChild>
                      <Link
                        to={path}
                        onClick={() => setSidebarOpen(false)}
                        className={cn(
                          "flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors duration-200 group relative overflow-hidden",
                          isActive
                            ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                            : "text-muted-foreground",
                          isCollapsed ? "lg:justify-center lg:px-0" : "",
                        )}
                      >
                        <Icon
                          className={cn(
                            "h-5 w-5 shrink-0",
                            isActive ? "text-primary-foreground" : "text-muted-foreground",
                          )}
                        />
                        <span className={cn("whitespace-nowrap", isCollapsed && "lg:hidden")}>
                          {t(key)}
                        </span>
                      </Link>
                    </TooltipTrigger>
                    {isCollapsed && (
                      <TooltipContent
                        side="right"
                        className="ml-4 bg-popover text-popover-foreground shadow-premium backdrop-blur-md rounded-xl border border-white/5"
                      >
                        {t(key)}
                      </TooltipContent>
                    )}
                  </Tooltip>
                );
              })}
            </TooltipProvider>
          </nav>
          <SidebarFooter collapsed={isCollapsed} onNavigate={() => setSidebarOpen(false)} />
        </div>
        {!isCollapsed && (
          <div
            {...sidebar.handleProps}
            className="monline-sidebar-resize-handle"
            aria-label={t("resize_sidebar")}
            title={t("resize_sidebar_hint")}
          />
        )}
      </aside>

      {/* Main content */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden relative">
        <header className="flex h-[var(--monline-header-height)] shrink-0 items-center justify-between border-b border-border bg-background px-4 md:px-8 lg:px-10">
          <div className="flex shrink-0 items-center gap-2 lg:hidden">
            <Button
              variant="ghost"
              size="icon"
              ref={menuButton}
              onClick={() => setSidebarOpen(true)}
              aria-label={t("open_menu")}
              aria-controls="monline-sidebar"
              aria-expanded={sidebarOpen}
            >
              <Menu className="h-5 w-5" />
            </Button>
            <Link
              to="/dashboard"
              aria-label={t("go_home")}
              onClick={() => setSidebarOpen(false)}
              className="rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
            >
              <LogoIcon className="h-7 w-7 sm:hidden" />
              <LogoWithName className="hidden h-7 w-auto sm:inline-flex" />
            </Link>
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
            <Link
              to="/subscriptions"
              className="flex h-11 items-center gap-2 rounded-xl border border-border bg-card px-3 text-[13px] text-muted-foreground transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-foreground/50"
              aria-label={`${t("active_subscriptions")}: ${summary.data?.count ?? "—"}`}
              title={t("active_subscriptions")}
            >
              <span
                className="header-subscription-heartbeat h-2 w-2 shrink-0 rounded-full"
                aria-hidden="true"
              />
              <span className="hidden sm:inline">{t("active_subscriptions")}</span>
              <span className="font-semibold tabular-nums text-foreground">
                {summary.data?.count ?? "—"}
              </span>
            </Link>
            <time
              dateTime={today}
              className="hidden h-11 items-center gap-2 whitespace-nowrap rounded-xl border border-border bg-card px-3 text-[13px] text-muted-foreground md:flex"
            >
              <Calendar className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{todayLabel}</span>
            </time>
            <ThemeToggle />
            <ProfileMenu />
          </div>
        </header>

        {/* Page content */}
        <main
          className={cn(
            "monline-page min-h-0 min-w-0 flex-1 overflow-y-auto w-full max-w-[1600px] mx-auto p-4 md:p-8 lg:p-10",
            pathname.startsWith("/calendar") && "monline-calendar-content",
            pathname === "/dashboard" && "monline-dashboard-content",
          )}
        >
          <Suspense fallback={<PageLoading />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
}
