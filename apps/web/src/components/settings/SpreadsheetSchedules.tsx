import { useQuery, useQueryClient } from "@tanstack/react-query";
import { HardDrive, Loader2, Settings2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { toast } from "@/lib/toast";

import { SpreadsheetDestinationConfig } from "./SpreadsheetDestinationConfig";
import { SpreadsheetInfo } from "./SpreadsheetInfo";

type Target = "nas" | "drive";
interface ExportJob {
  target: Target;
  enabled: boolean;
  interval_hours: number;
  configured: boolean;
  coming_soon?: boolean;
  connected: boolean;
  running: boolean;
  file_name: string;
  next_run: string | null;
  last_run: string | null;
  last_success: string | null;
  last_error: string;
}
interface ScheduleStatus { jobs: ExportJob[]; callback_url: string }

function TargetSchedule({ job, callbackUrl, refresh }: {
  job: ExportJob; callbackUrl: string; refresh: () => Promise<void>;
}) {
  const { t, i18n } = useTranslation();
  const { isAdmin } = useAuth();
  const [enabled, setEnabled] = useState(job.enabled);
  const [interval, setInterval] = useState(job.interval_hours);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [configOpen, setConfigOpen] = useState(false);
  useEffect(() => {
    setEnabled(job.enabled);
    setInterval(job.interval_hours);
  }, [job.enabled, job.interval_hours]);
  const ready = job.configured && (job.target === "nas" || job.connected);
  const comingSoon = job.coming_soon ?? (job.target === "drive");
  const disabled = comingSoon || !!busy || job.running;
  const title = job.target === "nas" ? "NAS" : "Google Drive";
  const date = (value: string | null) => value
    ? new Intl.DateTimeFormat(i18n.resolvedLanguage || "en", { dateStyle: "short", timeStyle: "short" }).format(new Date(value))
    : t("spreadsheet_schedule_never");
  async function action(name: string, execute: () => Promise<void>) {
    if (disabled) return;
    setBusy(name);
    setError("");
    try { await execute(); }
    catch (err) {
      const key = err instanceof Error && err.message.startsWith("spreadsheet_schedule_")
        ? err.message : "spreadsheet_schedule_failed";
      setError(t(key));
    } finally {
      await refresh().catch(() => {});
      setBusy("");
    }
  }
  return (
    <section className="flex h-full flex-col gap-4 rounded-2xl border p-4 [container-type:inline-size] sm:p-5" aria-label={title}>
      <div className="flex items-center gap-2">
        <div className="flex shrink-0 items-center gap-1">
          <h3 className="flex items-center gap-2 whitespace-nowrap text-sm font-semibold">
            {job.target === "nas" ? <HardDrive className="h-4 w-4 shrink-0 text-primary" /> :
              <img src="/google-drive.png" alt="" aria-hidden="true" className="h-4 w-4 shrink-0" width={16} height={16} />}
            {title}
          </h3>
          <SpreadsheetInfo title={title} disabled={comingSoon}>
            <p>{t("spreadsheet_schedule_" + job.target + "_description")}</p>
            <p>{t(isAdmin ? "spreadsheet_schedule_" + job.target + "_setup" : "spreadsheet_schedule_ask_admin")}</p>
            {job.target === "drive" && <p>{t("spreadsheet_schedule_drive_oauth_help")}</p>}
            {job.target === "drive" && !job.configured && <p>{t("spreadsheet_schedule_drive_setup_required")}</p>}
          </SpreadsheetInfo>
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <Badge variant="outline" className={"whitespace-nowrap text-[11px] " +
            (!comingSoon && ready ? "border-primary/30 bg-primary/10 text-primary" : "text-muted-foreground")}>
            {t(comingSoon ? "spreadsheet_schedule_coming_soon" :
              ready ? "spreadsheet_schedule_ready" : "spreadsheet_schedule_setup")}
          </Badge>
          {isAdmin && (
            <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => setConfigOpen(true)}
              className="h-8 shrink-0 gap-1.5 px-2 text-xs"
              aria-label={t("spreadsheet_schedule_configure")} title={t("spreadsheet_schedule_configure")}>
              <Settings2 className="h-3.5 w-3.5" />
              <span className="[@container(max-width:23rem)]:sr-only">{t("spreadsheet_schedule_configure")}</span>
            </Button>
          )}
        </div>
      </div>
      {job.target === "nas" && isAdmin && (
        <Button variant="outline" disabled={disabled || !ready} onClick={() => void action("probe", async () => {
          await api.post("/api/spreadsheet-integrations/nas/probe", undefined, { timeoutMs: 150000 });
          toast.success(t("spreadsheet_schedule_smb_connected"));
        })}>
          {busy === "probe" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {t("spreadsheet_schedule_test_connection")}
        </Button>
      )}
      {job.target === "drive" && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" disabled={disabled || !job.configured} onClick={() => {
              void action("connect", async () => {
                const result = await api.post<{ url: string }>("/api/spreadsheet-schedules/drive/connect");
                window.location.assign(result.url);
              });
            }}>
              {t(job.connected ? "spreadsheet_schedule_reconnect_action" : "spreadsheet_schedule_connect")}
            </Button>
            {job.connected && (
              <Button variant="ghost" disabled={disabled} onClick={() => void action("disconnect", async () => {
                await api.del("/api/spreadsheet-schedules/drive/connection");
                toast.success(t("spreadsheet_schedule_disconnected"));
              })}>{t("spreadsheet_schedule_disconnect")}</Button>
            )}
          </div>
        </div>
      )}
      <div className="flex items-center justify-between gap-4">
        <Label htmlFor={"export-enabled-" + job.target}>{t("spreadsheet_schedule_enabled")}</Label>
        <Switch id={"export-enabled-" + job.target} checked={!comingSoon && enabled}
          onCheckedChange={setEnabled} disabled={disabled || (!ready && !enabled)} />
      </div>
      {(job.target !== "nas" || enabled) && <div className="grid gap-2">
        <Label htmlFor={"export-interval-" + job.target}>{t("spreadsheet_schedule_interval")}</Label>
        <Select value={String(interval)} onValueChange={(value) => setInterval(Number(value))} disabled={disabled}>
          <SelectTrigger id={"export-interval-" + job.target}><SelectValue /></SelectTrigger>
          <SelectContent>
            {[1, 6, 12, 24, 168].map((hours) => (
              <SelectItem key={hours} value={String(hours)}>{t("spreadsheet_schedule_every_" + hours)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>}
      <dl className="grid gap-2 text-xs">
        <div className="grid gap-1"><dt className="text-muted-foreground">{t("spreadsheet_schedule_filename")}</dt><dd className="break-all">{job.file_name}</dd></div>
        <div className="grid gap-1"><dt className="text-muted-foreground">{t("spreadsheet_schedule_last_success")}</dt><dd>{date(job.last_success)}</dd></div>
        <div className="grid gap-1"><dt className="text-muted-foreground">{t("spreadsheet_schedule_next")}</dt><dd>{!comingSoon && job.enabled ? date(job.next_run) : t("spreadsheet_schedule_paused")}</dd></div>
      </dl>
      {!comingSoon && (error || job.last_error) && (
        <p role="alert" className="text-sm text-destructive">{error || t(job.last_error)}</p>
      )}
      <div className="mt-auto flex flex-wrap gap-2">
        <Button variant={comingSoon ? "secondary" : "default"}
          className={comingSoon ? "bg-muted text-muted-foreground disabled:opacity-100" : undefined}
          disabled={disabled || (enabled && !ready)} onClick={() => void action("save", async () => {
          const language = (i18n.resolvedLanguage || "en").split("-")[0];
          await api.put("/api/spreadsheet-schedules/" + job.target, {
            enabled, interval_hours: interval,
            language: ["tr", "de", "bg"].includes(language) ? language : "en",
            theme: document.documentElement.classList.contains("dark") ? "dark" : "light",
          });
          toast.success(t("spreadsheet_schedule_saved"));
        })}>
          {busy === "save" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {t("spreadsheet_schedule_save")}
        </Button>
        <Button variant="outline" disabled={disabled || !ready} onClick={() => void action("run", async () => {
          await api.post("/api/spreadsheet-schedules/" + job.target + "/run", undefined, { timeoutMs: 300000 });
          toast.success(t("spreadsheet_schedule_sent"));
        })}>
          {(busy === "run" || job.running) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {t(busy === "run" || job.running ? "spreadsheet_schedule_sending" : "spreadsheet_schedule_send_now")}
        </Button>
      </div>
      {isAdmin && !comingSoon && (
        <SpreadsheetDestinationConfig target={job.target} open={configOpen} onOpenChange={setConfigOpen}
          callbackUrl={callbackUrl} refresh={refresh} />
      )}
    </section>
  );
}

export function SpreadsheetSchedules() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const cache = useQueryClient();
  const queryKey = ["spreadsheet-schedules", user?.id];
  const query = useQuery({
    queryKey, queryFn: () => api.get<ScheduleStatus>("/api/spreadsheet-schedules"),
    enabled: !!user, refetchInterval: 10000,
  });
  useEffect(() => {
    const result = window.location.hash;
    if (result === "#drive=connected") toast.success(t("spreadsheet_schedule_connected"));
    else if (result === "#drive=failed") toast.error(t("spreadsheet_schedule_connect_failed"));
    else return;
    window.history.replaceState(window.history.state, "", window.location.pathname + window.location.search);
  }, [t]);
  return (
    <div className="space-y-4 pt-5">
      <div className="flex items-center gap-1">
        <h3 className="text-base font-semibold">{t("spreadsheet_schedule_title")}</h3>
        <SpreadsheetInfo title={t("spreadsheet_schedule_title")}>
          <p>{t("spreadsheet_schedule_description")}</p>
          <p>{t("spreadsheet_schedule_appearance")}</p>
        </SpreadsheetInfo>
      </div>
      {query.isLoading && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
      {query.isError && <p role="alert" className="text-sm text-destructive">{t("spreadsheet_schedule_load_failed")}</p>}
      {query.data && (
        <div className="grid gap-4 xl:grid-cols-2">
          {query.data.jobs.map((job) => (
            <TargetSchedule key={user?.id + job.target} job={job} callbackUrl={query.data.callback_url}
              refresh={() => cache.invalidateQueries({ queryKey })} />
          ))}
        </div>
      )}
    </div>
  );
}
