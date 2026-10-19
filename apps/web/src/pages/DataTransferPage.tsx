import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  FileArchive,
  FileJson,
  FolderOpen,
  Info,
  Loader2,
} from "lucide-react";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import client from "@/lib/client";
import { toast } from "@/lib/toast";
import {
  type AccountBackup,
  exportBackup,
  exportInstanceBackup,
  importData,
  type ImportResult,
  readImportFile,
  TRANSFER_COLLECTIONS,
} from "@/services/dataTransfer";
import { serverSettingsService } from "@/services/serverSettings";

type InstanceFile = { file: File; legacy: boolean };

export function DataTransferPage() {
  const { t } = useTranslation();
  const { user, refreshUser, isAdmin, isLoading } = useAuth();
  const queryClient = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<AccountBackup | null>(null);
  const [archive, setArchive] = useState<InstanceFile | null>(null);
  const [confirmRestore, setConfirmRestore] = useState(false);
  const [filename, setFilename] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);
  const disabled = !!busy || isLoading || !user;

  async function run(name: string, action: () => Promise<void>) {
    if (busy) return;
    setBusy(name);
    setError("");
    setProgress("");
    try {
      await action();
    } catch (err) {
      const key =
        err instanceof Error && err.message.startsWith("transfer_")
          ? err.message
          : name === "read"
            ? "transfer_invalid_backup"
            : name === "restore"
              ? "transfer_instance_restore_failed"
              : name === "import"
                ? "transfer_import_failed"
                : "transfer_export_failed";
      setError(t(key));
    } finally {
      setBusy(null);
      setProgress("");
    }
  }

  async function chooseFile(file: File) {
    if (isAdmin && !file.name.toLowerCase().endsWith(".json")) {
      if (file.size > 500 * 1024 * 1024) throw new Error("transfer_instance_too_large");
      const prefix = new Uint8Array(await file.slice(0, 16).arrayBuffer());
      const legacy = new TextDecoder().decode(prefix) === "SQLite format 3\0";
      if (!legacy && !(prefix[0] === 0x1f && prefix[1] === 0x8b))
        throw new Error("transfer_invalid_backup");
      setArchive({ file, legacy });
    } else setSelected(await readImportFile(file));
  }

  async function restoreAccount() {
    if (!selected || !user) return;
    const imported = await importData(selected);
    setResult(imported);
    setSelected(null);
    await queryClient.invalidateQueries();
    await refreshUser();
  }

  async function restoreInstance() {
    if (!archive || !isAdmin) return;
    const form = new FormData();
    form.set("file", archive.file);
    await serverSettingsService.restore(form);
    queryClient.clear();
    client.authStore.clear();
    toast.success(t("instance_restore_success"));
    window.location.assign("/login");
  }

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden rounded-3xl">
        <CardHeader className="border-b bg-muted/20">
          <CardTitle className="flex items-center gap-2 text-lg">
            <ArrowDownToLine className="h-5 w-5 text-primary" />
            {t("transfer_export_title")}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {t(isAdmin ? "transfer_instance_export_description" : "transfer_export_description")}
          </p>
        </CardHeader>
        <CardContent className="space-y-5 pt-6">
          <div className="flex flex-col gap-4 rounded-2xl border bg-muted/10 p-5 sm:flex-row sm:items-center">
            {isAdmin ? (
              <FileArchive className="h-9 w-9 shrink-0 text-primary" />
            ) : (
              <FileJson className="h-9 w-9 shrink-0 text-primary" />
            )}
            <div className="flex-1 space-y-1">
              <h3 className="font-semibold">
                {t(isAdmin ? "transfer_instance_title" : "transfer_backup_title")}
              </h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {t(isAdmin ? "transfer_instance_description" : "transfer_backup_description")}
              </p>
            </div>
            <Button
              disabled={disabled}
              className="shrink-0 rounded-xl"
              onClick={() =>
                void run("backup", () =>
                  isAdmin
                    ? exportInstanceBackup()
                    : exportBackup((done, total) =>
                        setProgress(t("transfer_file_progress", { done, total })),
                      ),
                )
              }
            >
              {busy === "backup" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ArrowDownToLine className="mr-2 h-4 w-4" />
              )}
              {t(busy === "backup" ? "transfer_preparing" : "transfer_export_action")}
            </Button>
          </div>
          <div className="flex items-start gap-3 rounded-2xl border border-orange-400/40 bg-orange-500/10 p-4 text-sm text-orange-800 dark:text-orange-200">
            <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <div className="min-w-0 leading-relaxed">
              <p>{t(isAdmin ? "transfer_instance_scope" : "transfer_scope")}</p>
              <p className="mt-2 text-xs">
                {t(isAdmin ? "transfer_instance_limits" : "transfer_secrets_excluded")}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card className="overflow-hidden rounded-3xl">
        <CardHeader className="border-b bg-muted/20">
          <CardTitle className="flex items-center gap-2 text-lg">
            <ArrowUpFromLine className="h-5 w-5 text-primary" />
            {t("transfer_import_title")}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {t(isAdmin ? "transfer_instance_import_description" : "transfer_import_description")}
          </p>
        </CardHeader>
        <CardContent className="space-y-5 pt-6">
          <div className="space-y-2">
            <Label htmlFor="backup-file">{t("transfer_choose_file")}</Label>
            <input
              ref={fileInput}
              id="backup-file"
              type="file"
              accept={isAdmin ? ".tar.gz,.tgz,.db,.json" : ".json,application/json"}
              hidden
              disabled={disabled}
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                setSelected(null);
                setArchive(null);
                setResult(null);
                setError("");
                setFilename(file?.name ?? "");
                if (file) void run("read", () => chooseFile(file));
              }}
            />
            <div className="flex min-w-0 flex-col gap-3 rounded-xl border border-input bg-background p-3 text-foreground sm:flex-row sm:items-center">
              <Button
                type="button"
                variant="secondary"
                disabled={disabled}
                className="shrink-0 rounded-lg"
                aria-describedby="backup-file-name"
                onClick={() => fileInput.current?.click()}
              >
                <FolderOpen className="mr-2 h-4 w-4" />
                {t("transfer_browse")}
              </Button>
              <span
                id="backup-file-name"
                aria-live="polite"
                className="min-w-0 break-all text-sm text-muted-foreground"
              >
                {filename || t("transfer_no_file")}
              </span>
            </div>
          </div>
          {selected && (
            <div className="space-y-4 rounded-2xl border p-4">
              <dl className="grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
                {TRANSFER_COLLECTIONS.map((name) => (
                  <div
                    key={name}
                    className="flex items-center justify-between gap-3 border-b py-1.5"
                  >
                    <dt className="text-muted-foreground">{t("transfer_data_" + name)}</dt>
                    <dd className="font-semibold tabular-nums">{selected.data[name].length}</dd>
                  </div>
                ))}
                <div className="flex justify-between gap-3 border-b py-1.5">
                  <dt className="text-muted-foreground">{t("transfer_files")}</dt>
                  <dd className="font-semibold">{selected.files.length}</dd>
                </div>
              </dl>
              <p className="text-sm text-muted-foreground">{t("transfer_merge_note")}</p>
              <Button
                className="rounded-xl"
                disabled={disabled}
                onClick={() => void run("import", restoreAccount)}
              >
                {busy === "import" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t("transfer_import_action")}
              </Button>
            </div>
          )}
          {archive && isAdmin && (
            <div className="space-y-4 rounded-2xl border p-4">
              <p className="text-sm text-muted-foreground">
                {t(
                  archive.legacy
                    ? "transfer_instance_legacy_note"
                    : "transfer_instance_restore_note",
                )}
              </p>
              <Button
                className="rounded-xl"
                disabled={disabled}
                onClick={() => setConfirmRestore(true)}
              >
                {busy === "restore" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t("transfer_import_action")}
              </Button>
            </div>
          )}
          {result && (
            <div
              role="status"
              className="rounded-2xl border border-primary/30 bg-primary/5 p-4 text-sm"
            >
              {t("transfer_import_result", { imported: result.imported, skipped: result.skipped })}
            </div>
          )}
        </CardContent>
      </Card>
      {busy && (
        <p role="status" className="text-sm text-muted-foreground">
          {progress || t(["import", "restore"].includes(busy) ? "importing" : "transfer_preparing")}
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"
        >
          {error}
        </p>
      )}
      <AlertDialog open={confirmRestore && !!archive && isAdmin} onOpenChange={setConfirmRestore}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("transfer_import_title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t(archive?.legacy ? "instance_restore_confirm_legacy" : "instance_restore_confirm")}
            </AlertDialogDescription>
            <p className="break-all text-sm">{archive?.file.name}</p>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmRestore(false);
                void run("restore", restoreInstance);
              }}
            >
              {t("transfer_import_action")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
