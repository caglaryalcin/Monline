import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  ChevronLeft,
  ChevronRight,
  Edit2,
  KeyRound,
  LogOut,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  Users,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { AdminUserDialog } from "@/components/admin/AdminUserDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/lib/toast";
import type { AdminUser } from "@/services/adminUsers";
import { adminUsersKeys, adminUsersService } from "@/services/adminUsers";

type AdminAction = { kind: "delete" | "sessions" | "disable"; user: AdminUser };

export function AdminUsersTab() {
  const { t, i18n } = useTranslation();
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(3);
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const resize = () => {
      const top = container.current?.getBoundingClientRect().top ?? 160;
      const width = container.current?.clientWidth ?? 700;
      const rowHeight = width < 600 ? 142 : 112;
      setPerPage(
        Math.max(1, Math.min(10, Math.floor((window.innerHeight - top - 286) / rowHeight))),
      );
      setPage(1);
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);
  const [editing, setEditing] = useState<AdminUser | "new" | null>(null);
  const [action, setAction] = useState<AdminAction | null>(null);
  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(search.trim());
      setPage(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);
  const users = useQuery({
    queryKey: adminUsersKeys.list(query, page, perPage),
    queryFn: ({ signal }) => adminUsersService.list(query, page, signal, perPage),
    enabled: isAdmin,
  });
  const refresh = () => qc.invalidateQueries({ queryKey: adminUsersKeys.all });
  const mutate = useMutation({
    mutationFn: async (target: AdminAction) => {
      if (target.kind === "delete") await adminUsersService.delete(target.user.id);
      else if (target.kind === "sessions") await adminUsersService.revokeSessions(target.user.id);
      else await adminUsersService.update(target.user.id, { disabled: !target.user.disabled });
    },
    onSuccess: (_data, target) => {
      setAction(null);
      if (target.kind === "delete" && users.data?.items.length === 1 && page > 1)
        setPage((current) => current - 1);
      refresh();
      toast.success(t("success"));
    },
    onError: (error: Error) => {
      refresh();
      toast.error(t(error.message, { defaultValue: t("admin_users_request_failed") }));
    },
  });
  const formatCreated = (value: string) => {
    const date = new Date(value.replace(" ", "T"));
    return Number.isFinite(date.getTime())
      ? new Intl.DateTimeFormat((i18n.resolvedLanguage || "en").replace(/_/g, "-"), {
          dateStyle: "medium",
        }).format(date)
      : "—";
  };
  if (!isAdmin) return <p role="alert">{t("admin_users_forbidden")}</p>;
  return (
    <div ref={container} className="animate-in space-y-3 fade-in duration-300">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="flex items-center gap-2 text-xl font-bold tracking-tight">
            <ShieldCheck className="h-5 w-5 text-primary" />
            {t("admin_users_title")}
          </h2>
          <p className="max-w-2xl text-xs leading-relaxed text-muted-foreground">
            {t("admin_users_description")}
          </p>
        </div>
        <Button
          className="h-8 gap-2 rounded-lg text-xs"
          onClick={() => setEditing("new")}
          disabled={mutate.isPending}
        >
          <Plus className="h-4 w-4" />
          {t("admin_users_create")}
        </Button>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "admin_users_total", value: users.data?.totalAccounts },
          {
            label: "admin_users_active",
            value: users.data ? users.data.totalAccounts - users.data.disabledAccounts : undefined,
          },
          { label: "admin_users_disabled", value: users.data?.disabledAccounts },
        ].map((stat) => (
          <div
            key={stat.label}
            className="flex items-center justify-between gap-2 rounded-xl border bg-card/60 px-3 py-2"
          >
            <p className="text-xs font-medium text-muted-foreground">{t(stat.label)}</p>
            <p className="text-lg font-semibold tabular-nums">{stat.value ?? "—"}</p>
          </div>
        ))}
      </div>
      <section
        className="overflow-hidden rounded-2xl border bg-card/50"
        aria-labelledby="admin-users-title"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2">
          <h2 id="admin-users-title" className="flex items-center gap-2 font-semibold">
            <Users className="h-4 w-4 text-muted-foreground" />
            {t("admin_users_title")}
          </h2>
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <div className="relative min-w-0 flex-1 sm:w-64">
              <Search
                className="absolute left-3 top-2 h-4 w-4 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                value={search}
                maxLength={254}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t("admin_users_search")}
                aria-label={t("admin_users_search")}
                className="h-8 rounded-lg bg-background pl-9 text-xs"
              />
            </div>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 rounded-lg"
              onClick={() => users.refetch()}
              disabled={users.isFetching}
              aria-label={t("sharing_refresh")}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>
        {users.isPending && (
          <p role="status" className="p-6 text-sm text-muted-foreground">
            {t("loading")}
          </p>
        )}
        {users.isError && (
          <p role="alert" className="p-6 text-sm text-destructive">
            {t(users.error.message, { defaultValue: t("admin_users_request_failed") })}
          </p>
        )}
        {users.data && (
          <div className="divide-y">
            {users.data.items.length === 0 && (
              <p className="p-8 text-center text-sm text-muted-foreground">
                {t("admin_users_empty")}
              </p>
            )}
            {users.data.items.map((account) => (
              <div
                key={account.id}
                className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"
              >
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border bg-muted/30 text-muted-foreground">
                    {account.is_admin ? (
                      <ShieldCheck className="h-5 w-5" />
                    ) : (
                      <Users className="h-4 w-4" />
                    )}
                  </div>
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate text-sm font-semibold">
                        {account.name || account.email}
                      </h3>
                      {account.is_admin && (
                        <Badge variant="secondary">{t("admin_users_admin")}</Badge>
                      )}
                      <Badge
                        variant="outline"
                        className={
                          account.disabled
                            ? "border-destructive/30 text-destructive"
                            : "text-muted-foreground"
                        }
                      >
                        {t(account.disabled ? "admin_users_suspended" : "active")}
                      </Badge>
                    </div>
                    <p className="truncate text-xs text-muted-foreground">{account.email}</p>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                      <span>
                        {t("admin_users_registered", { date: formatCreated(account.created) })}
                      </span>
                      <span>
                        {t("admin_users_subscription_count", { count: account.subscription_count })}
                      </span>
                      <span>
                        {t("admin_users_session_count", { count: account.session_count })}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                      <span>
                        {t(
                          account.verified
                            ? "admin_users_email_verified"
                            : "admin_users_email_unverified",
                        )}
                      </span>
                      {account.totp_enabled && (
                        <span className="inline-flex items-center gap-1">
                          <KeyRound className="h-3 w-3" />
                          2FA
                        </span>
                      )}
                      {account.oidc_linked && <span>OIDC</span>}
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {account.is_admin ? (
                    <Button asChild variant="outline" size="sm" className="h-8 rounded-lg text-xs">
                      <Link to="/settings" search={{ tab: "profile" }}>
                        {t("profile")}
                      </Link>
                    </Button>
                  ) : (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 gap-1.5 rounded-lg text-xs"
                        disabled={mutate.isPending}
                        onClick={() => setEditing(account)}
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                        {t("edit")}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 rounded-lg text-xs"
                        disabled={mutate.isPending}
                        onClick={() =>
                          account.disabled
                            ? mutate.mutate({ kind: "disable", user: account })
                            : setAction({ kind: "disable", user: account })
                        }
                      >
                        {t(account.disabled ? "admin_users_enable" : "admin_users_suspend")}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-xl text-muted-foreground"
                        disabled={mutate.isPending}
                        onClick={() => setAction({ kind: "sessions", user: account })}
                        aria-label={t("admin_users_revoke")}
                        title={t("admin_users_revoke")}
                      >
                        <LogOut className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-xl text-destructive"
                        disabled={mutate.isPending}
                        onClick={() => setAction({ kind: "delete", user: account })}
                        aria-label={t("delete")}
                        title={t("delete")}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        {users.data && users.data.totalPages > 1 && (
          <div className="flex items-center justify-between gap-3 border-t px-3 py-2">
            <p className="text-xs text-muted-foreground">
              {t("admin_users_page", { page, total: users.data.totalPages })}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 rounded-lg"
                aria-label={t("admin_users_previous")}
                disabled={page <= 1 || users.isFetching}
                onClick={() => setPage((current) => current - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 rounded-lg"
                aria-label={t("admin_users_next")}
                disabled={page >= users.data.totalPages || users.isFetching}
                onClick={() => setPage((current) => current + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </section>
      {editing && (
        <AdminUserDialog
          user={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => refresh()}
        />
      )}
      <ConfirmDialog
        open={!!action}
        onOpenChange={(open) => !open && !mutate.isPending && setAction(null)}
        title={t(
          action?.kind === "delete"
            ? "admin_users_delete"
            : action?.kind === "sessions"
              ? "admin_users_revoke"
              : "admin_users_suspend",
        )}
        description={t(
          action?.kind === "delete"
            ? "admin_users_delete_confirm"
            : action?.kind === "sessions"
              ? "admin_users_revoke_confirm"
              : "admin_users_suspend_confirm",
          { email: action?.user.email ?? "" },
        )}
        confirmLabel={t(action?.kind === "delete" ? "delete" : "admin_users_confirm")}
        onConfirm={() => {
          if (action && !mutate.isPending) mutate.mutate(action);
        }}
      />
    </div>
  );
}
