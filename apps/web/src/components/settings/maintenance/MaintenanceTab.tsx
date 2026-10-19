import {
  CircleCheck,
  Database,
  Loader2,
  ScanLine,
  Trash2,
  TriangleAlert,
  Wrench,
} from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast";
import { type DatabaseMaintenanceResult,serverSettingsService } from "@/services/serverSettings";

export function MaintenanceTab() {
  const { t, i18n } = useTranslation();
  const [busy, setBusy] = useState<"logos" | "check" | "optimize" | null>(null);
  const [result, setResult] = useState<DatabaseMaintenanceResult | null>(null);

  const cleanupLogos = async () => {
    setBusy("logos");
    try {
      const data = await serverSettingsService.deleteUnusedLogos();
      toast.success(t("logos_deleted", { count: data.deleted }));
    } catch {
      toast.error(t("error"));
    } finally {
      setBusy(null);
    }
  };

  const maintain = async (action: "check" | "optimize") => {
    setBusy(action);
    setResult(null);
    try {
      const data = await serverSettingsService.maintainDatabase(action);
      setResult(data);
      if (data.ok)
        toast.success(
          t(action === "check" ? "database_check_success" : "database_optimize_success"),
        );
      else
        toast.error(
          t(data.safetyBackup ? "database_postcheck_failed" : "database_integrity_failed"),
        );
    } catch (error) {
      const code = error instanceof Error ? error.message : "";
      toast.error(
        t(
          [
            "database_maintenance_busy",
            "database_maintenance_disk_space",
            "database_maintenance_failed",
          ].includes(code)
            ? code
            : "error",
        ),
      );
    } finally {
      setBusy(null);
    }
  };

  const formatSize = (bytes: number) => {
    const unit = bytes >= 1024 * 1024 ? "MiB" : "KiB";
    const divisor = unit === "MiB" ? 1024 * 1024 : 1024;
    return `${new Intl.NumberFormat(i18n?.resolvedLanguage, { maximumFractionDigits: 2 }).format(bytes / divisor)} ${unit}`;
  };

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <section
        className="rounded-2xl border bg-card p-6 space-y-4"
        aria-busy={busy === "check" || busy === "optimize"}
      >
        <div className="flex items-center gap-3">
          <Database className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-lg">{t("database_maintenance")}</h3>
        </div>
        <p className="text-sm text-muted-foreground">{t("database_maintenance_description")}</p>
        <div className="flex flex-wrap gap-3">
          <Button
            variant="outline"
            disabled={!!busy}
            onClick={() => void maintain("check")}
            className="rounded-xl"
          >
            {busy === "check" ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <ScanLine className="w-4 h-4 mr-2" />
            )}
            {t("database_check")}
          </Button>
          <Button
            disabled={!!busy}
            onClick={() => void maintain("optimize")}
            className="rounded-xl"
          >
            {busy === "optimize" ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Wrench className="w-4 h-4 mr-2" />
            )}
            {t("database_optimize")}
          </Button>
        </div>
        {!!busy && busy !== "logos" && (
          <p role="status" className="text-sm text-muted-foreground">
            {t("database_maintenance_running")}
          </p>
        )}
        {result && (
          <div role="status" className="space-y-3 text-sm">
            <div
              className={`flex items-start gap-2 rounded-xl border p-3 ${result.ok ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "border-destructive/30 bg-destructive/10 text-destructive"}`}
            >
              {result.ok ? (
                <CircleCheck className="h-4 w-4 shrink-0 mt-0.5" />
              ) : (
                <TriangleAlert className="h-4 w-4 shrink-0 mt-0.5" />
              )}
              <span>
                {t(
                  result.ok
                    ? result.action === "check"
                      ? "database_check_success"
                      : "database_optimize_success"
                    : result.safetyBackup
                      ? "database_postcheck_failed"
                      : "database_integrity_failed",
                )}
              </span>
            </div>
            <dl className="grid gap-3 sm:grid-cols-3">
              {(
                [
                  ["database_size", result.after.logicalBytes],
                  ["database_wal_size", result.after.walBytes],
                  ["database_free_space", result.after.freeBytes],
                ] as const
              ).map(([label, value]) => (
                <div key={label} className="rounded-xl border p-3">
                  <dt className="text-muted-foreground">{t(label)}</dt>
                  <dd className="mt-1 font-medium tabular-nums">{formatSize(value)}</dd>
                </div>
              ))}
            </dl>
            {result.action === "optimize" && result.ok && (
              <p className="text-muted-foreground">
                {t("database_reclaimed", {
                  size: formatSize(
                    Math.max(0, result.before.logicalBytes - result.after.logicalBytes),
                  ),
                })}
              </p>
            )}
            {result.safetyBackup && (
              <p className="break-words text-muted-foreground">
                {t("database_safety_backup", { file: result.safetyBackup })}
              </p>
            )}
            {result.checkpointBusy && (
              <p className="text-amber-700 dark:text-amber-300">{t("database_checkpoint_busy")}</p>
            )}
          </div>
        )}
      </section>
      <section className="rounded-2xl border bg-card p-6 space-y-3">
        <div className="flex items-center gap-3">
          <Trash2 className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-lg">{t("cleanup_logos")}</h3>
        </div>
        <p className="text-sm text-muted-foreground">{t("cleanup_logos_description")}</p>
        <Button disabled={!!busy} onClick={cleanupLogos} className="rounded-xl">
          {busy === "logos" ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Trash2 className="w-4 h-4 mr-2" />
          )}
          {t("cleanup_logos")}
        </Button>
      </section>
    </div>
  );
}
