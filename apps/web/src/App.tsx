import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { AppMetadata } from "@/components/AppMetadata";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { createAppRouter } from "@/routes";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (attempt, error) => {
        const status = error && typeof error === "object" && "status" in error ? error.status : 0;
        return attempt < 1 && ![400, 401, 403, 404].includes(Number(status));
      },
      staleTime: 5 * 60_000, // 5 minutes — data is stable; no need to refetch every 30s
      refetchOnWindowFocus: true, // Refresh stale data when returning to a long-open tab.
    },
  },
});

function InnerApp() {
  const auth = useAuth();
  const { t } = useTranslation();
  const [router] = useState(() => createAppRouter({ queryClient, auth }));

  // Re-run guards only when access changes, not for every theme/profile edit.
  useEffect(() => {
    void router.invalidate();
  }, [router, auth.user?.id, auth.isAdmin, auth.isLoading]);

  if (auth.isLoading)
    return (
      <div
        role="status"
        aria-label={t("loading")}
        className="flex min-h-screen items-center justify-center bg-background"
      >
        <div
          aria-hidden="true"
          className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"
        />
      </div>
    );

  return <RouterProvider router={router} context={{ queryClient, auth }} />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppMetadata />
      <AuthProvider>
        <InnerApp />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
