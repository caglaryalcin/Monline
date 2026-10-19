import { Link } from "@tanstack/react-router";
import { ArchiveRestore, ArrowRight, FolderOpen, Loader2, Plus } from "lucide-react";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "@/lib/toast";
import { authService } from "@/services/auth";
import { setupService } from "@/services/setup";

const BACKUP_LIMIT = 500 * 1024 * 1024;

export function SetupStart({ onNew, preview }: { onNew: () => void; preview: boolean }) {
  const { t } = useTranslation();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const restore = async () => {
    if (!file || preview || busy) return;
    setBusy(true);
    setError("");
    try {
      const header = new Uint8Array(await file.slice(0, 2).arrayBuffer());
      if (header[0] !== 0x1f || header[1] !== 0x8b) throw new Error("setup_restore_full_required");
      await setupService.restore(file);
      authService.clear();
      toast.success(t("instance_restore_success"));
      window.location.assign("/login");
    } catch (failure) {
      const status =
        failure && typeof failure === "object" && "status" in failure ? failure.status : 0;
      const message = failure instanceof Error ? failure.message : "";
      const known = [
        "setup_already_complete",
        "setup_restore_full_required",
        "setup_restore_empty",
        "setup_restore_busy",
      ];
      setError(
        t(
          known.includes(message)
            ? message
            : status === 413
              ? "transfer_instance_too_large"
              : status === 400
                ? "setup_restore_invalid"
                : "setup_restore_failed",
        ),
      );
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6 p-6 sm:p-8">
      <div>
        <h2 className="text-lg font-semibold">{t("setup_start_title")}</h2>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          {t("setup_start_description")}
        </p>
      </div>
      <div className="grid items-stretch gap-5 md:grid-cols-2">
        <section className="flex h-full flex-col gap-4 rounded-2xl border bg-muted/10 p-5">
          <Plus className="h-7 w-7 text-primary" aria-hidden="true" />
          <div>
            <h3 className="font-semibold">{t("setup_new_install")}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {t("setup_new_install_description")}
            </p>
          </div>
          <Button
            type="button"
            disabled={busy}
            onClick={onNew}
            className="mt-auto w-full rounded-xl"
          >
            {t("setup_start_new")}
            <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
          </Button>
        </section>
        <section
          className="flex h-full flex-col gap-4 rounded-2xl border bg-muted/10 p-5"
          aria-busy={busy}
        >
          <ArchiveRestore className="h-7 w-7 text-primary" aria-hidden="true" />
          <div>
            <h3 className="font-semibold">{t("restore_from_backup")}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {t("setup_restore_description")}
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="setup-backup">{t("setup_restore_file")}</Label>
            <input
              ref={input}
              id="setup-backup"
              type="file"
              accept=".tar.gz,.tgz,application/gzip,application/x-gzip"
              disabled={busy || preview}
              className="sr-only"
              tabIndex={-1}
              aria-describedby="setup-backup-hint setup-backup-name"
              onChange={(event) => {
                const selected = event.target.files?.[0] ?? null;
                setError("");
                setFile(null);
                if (!selected) return;
                if (!/\.(tar\.gz|tgz)$/i.test(selected.name) || selected.size === 0) {
                  setError(t("setup_restore_full_required"));
                  return;
                }
                if (selected.size > BACKUP_LIMIT) {
                  setError(t("transfer_instance_too_large"));
                  return;
                }
                setFile(selected);
              }}
            />
            <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-background p-3">
              <Button
                type="button"
                variant="outline"
                disabled={busy || preview}
                onClick={() => input.current?.click()}
                aria-describedby="setup-backup-hint setup-backup-name"
              >
                <FolderOpen className="mr-2 h-4 w-4" aria-hidden="true" />
                {t("setup_restore_choose")}
              </Button>
              <span
                id="setup-backup-name"
                className="min-w-0 break-all text-xs text-muted-foreground"
                aria-live="polite"
              >
                {file?.name ?? t("setup_restore_no_file")}
              </span>
            </div>
            <p id="setup-backup-hint" className="text-xs text-muted-foreground">
              {t("setup_restore_hint")}
            </p>
          </div>
          {error && (
            <div
              role="alert"
              className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
            >
              <p>{error}</p>
              <Link to="/login" className="mt-1 inline-block underline underline-offset-4">
                {t("setup_back_to_login")}
              </Link>
            </div>
          )}
          {busy && (
            <p role="status" className="text-xs text-muted-foreground">
              {t("setup_restore_progress")}
            </p>
          )}
          <Button
            type="button"
            disabled={!file || busy || preview}
            onClick={() => void restore()}
            className="mt-auto w-full rounded-xl"
          >
            {busy ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <ArchiveRestore className="mr-2 h-4 w-4" aria-hidden="true" />
            )}
            {t(busy ? "setup_restoring" : "setup_restore_action")}
          </Button>
        </section>
      </div>
    </div>
  );
}
