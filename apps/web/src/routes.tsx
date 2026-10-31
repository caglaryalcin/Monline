import type { QueryClient } from "@tanstack/react-query";
import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  lazyRouteComponent,
  Outlet,
  redirect,
} from "@tanstack/react-router";
import { Toaster } from "sonner";

import { AppTheme } from "@/components/AppTheme";
import { Layout } from "@/components/Layout";
import { PageLoading } from "@/components/PageLoading";

// Router-aware lazy components expose preload(), so intent preloading can
// resolve their code before navigation instead of suspending the whole layout.
const LoginPage = lazyRouteComponent(() => import("@/pages/auth/LoginPage"), "LoginPage");
const SetupPage = lazyRouteComponent(() => import("@/pages/auth/SetupPage"), "SetupPage");
const RegisterPage = lazyRouteComponent(() => import("@/pages/auth/RegisterPage"), "RegisterPage");
const TotpPage = lazyRouteComponent(() => import("@/pages/auth/TotpPage"), "TotpPage");
const PasswordResetPage = lazyRouteComponent(
  () => import("@/pages/auth/PasswordResetPage"),
  "PasswordResetPage",
);
const OIDCCallbackPage = lazyRouteComponent(
  () => import("@/pages/auth/OIDCCallbackPage"),
  "OIDCCallbackPage",
);

const DashboardPage = lazyRouteComponent(() => import("@/pages/DashboardPage"), "DashboardPage");
const FinancePage = lazyRouteComponent(() => import("@/pages/FinancePage"), "FinancePage");
const AboutPage = lazyRouteComponent(() => import("@/pages/AboutPage"), "AboutPage");
const SubscriptionsPage = lazyRouteComponent(
  () => import("@/pages/SubscriptionsPage"),
  "SubscriptionsPage",
);
const CalendarPage = lazyRouteComponent(() => import("@/pages/CalendarPage"), "CalendarPage");
const StatisticsPage = lazyRouteComponent(() => import("@/pages/StatisticsPage"), "StatisticsPage");
const DebtPage = lazyRouteComponent(() => import("@/pages/DebtPage"), "DebtPage");
const StatementsPage = lazyRouteComponent(() => import("@/pages/StatementsPage"), "StatementsPage");
const StatementDetailPage = lazyRouteComponent(
  () => import("@/pages/StatementsPage"),
  "StatementDetailPage",
);
const SettingsPage = lazyRouteComponent(() => import("@/pages/SettingsPage"), "SettingsPage");
const AdminPage = lazyRouteComponent(() => import("@/pages/AdminPage"), "AdminPage");

// Types for router context
import type { SettingsSearch, User } from "@/types";

export interface RouterContext {
  queryClient: QueryClient;
  auth: {
    user: User | null;
    isLoading: boolean;
    isAdmin: boolean;
  };
}

// ─── Root Route ────────────────────────────────────────────────────────────────

const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: () => (
    <>
      <AppTheme />
      <Outlet />
      <Toaster richColors position="bottom-right" />
    </>
  ),
});

// ─── Auth Routes (public) ──────────────────────────────────────────────────────

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  component: LoginPage,
});

export const setupRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/setup",
  component: SetupPage,
  validateSearch: (search: Record<string, unknown>): { preview?: boolean } => ({
    preview:
      search.preview === true || search.preview === "1" || search.preview === 1 ? true : undefined,
  }),
});

const registerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/register",
  component: RegisterPage,
});

const totpRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/totp",
  component: TotpPage,
});

const passwordResetRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/password-reset",
  component: PasswordResetPage,
});

// Default redirect URL suggested in Settings → OIDC
const oidcCallbackRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/oidc/callback",
  component: OIDCCallbackPage,
});

// ─── Protected Layout Route ────────────────────────────────────────────────────

const protectedLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "protected",
  beforeLoad: ({ context }) => {
    if (context.auth.isLoading) return;
    if (!context.auth.user) {
      throw redirect({ to: "/login" });
    }
  },
  component: Layout,
  pendingComponent: () => (
    <div className="flex h-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  ),
});

// ─── Protected children routes ─────────────────────────────────────────────────

const indexRoute = createRoute({
  getParentRoute: () => protectedLayoutRoute,
  path: "/",
  beforeLoad: () => {
    throw redirect({ to: "/dashboard" });
  },
});

const dashboardRoute = createRoute({
  getParentRoute: () => protectedLayoutRoute,
  path: "/dashboard",
  component: DashboardPage,
});
const financeRoute = createRoute({
  getParentRoute: () => protectedLayoutRoute,
  path: "/finance",
  component: FinancePage,
});

const aboutRoute = createRoute({
  getParentRoute: () => protectedLayoutRoute,
  path: "/about",
  component: AboutPage,
});

const subscriptionsRoute = createRoute({
  getParentRoute: () => protectedLayoutRoute,
  path: "/subscriptions",
  component: SubscriptionsPage,
});

const calendarRoute = createRoute({
  getParentRoute: () => protectedLayoutRoute,
  path: "/calendar",
  component: CalendarPage,
});

const statisticsRoute = createRoute({
  getParentRoute: () => protectedLayoutRoute,
  path: "/statistics",
  component: StatisticsPage,
});

const dataTransferRoute = createRoute({
  getParentRoute: () => protectedLayoutRoute,
  path: "/data-transfer",
  beforeLoad: () => {
    throw redirect({ to: "/settings", search: { tab: "data_transfer" }, replace: true });
  },
});
const debtRoute = createRoute({
  getParentRoute: () => protectedLayoutRoute,
  path: "/debt",
  validateSearch: (search: Record<string, unknown>): { tab?: "installments" | "loans" } => ({
    tab: search.tab === "installments" || search.tab === "loans" ? search.tab : undefined,
  }),
  component: DebtPage,
});
const statementsRoute = createRoute({
  getParentRoute: () => protectedLayoutRoute,
  path: "/statements",
  component: StatementsPage,
});

export const settingsRoute = createRoute({
  getParentRoute: () => protectedLayoutRoute,
  path: "/settings",
  component: SettingsPage,
  validateSearch: (search: Record<string, unknown>): SettingsSearch => ({
    tab: typeof search.tab === "string" ? search.tab : undefined,
  }),
});

const statementDetailRoute = createRoute({
  getParentRoute: () => protectedLayoutRoute,
  path: "/statements/$statementId",
  component: StatementDetailPage,
});

export const adminRoute = createRoute({
  getParentRoute: () => protectedLayoutRoute,
  path: "/admin",
  component: AdminPage,
  validateSearch: (search: Record<string, unknown>): { tab?: string } => ({
    tab: typeof search.tab === "string" ? search.tab : undefined,
  }),
  beforeLoad: ({ context }) => {
    if (!context.auth.isLoading && !context.auth.isAdmin)
      throw redirect({ to: "/dashboard" });
  },
});

// ─── Catch-all ─────────────────────────────────────────────────────────────────

const catchAllRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "$",
  beforeLoad: () => {
    throw redirect({ to: "/dashboard" });
  },
});

// ─── Build route tree ──────────────────────────────────────────────────────────

const routeTree = rootRoute.addChildren([
  setupRoute,
  loginRoute,
  registerRoute,
  totpRoute,
  passwordResetRoute,
  oidcCallbackRoute,
  protectedLayoutRoute.addChildren([
    indexRoute,
    dashboardRoute,
    financeRoute,
    aboutRoute,
    subscriptionsRoute,
    calendarRoute,
    statisticsRoute,
    debtRoute,
    dataTransferRoute,
    statementsRoute,
    statementDetailRoute,
    settingsRoute,
    adminRoute,
  ]),
  catchAllRoute,
]);

// ─── Create router ─────────────────────────────────────────────────────────────

export function createAppRouter(context: RouterContext) {
  return createRouter({
    routeTree,
    context,
    defaultPreload: "intent",
    defaultPreloadDelay: 0,
    defaultPendingComponent: PageLoading,
    defaultPendingMs: 200,
    defaultPendingMinMs: 0,
  });
}

// Register the router for type safety
declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof createAppRouter>;
  }
}
