import { useQueryClient } from "@tanstack/react-query";
import { Download, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { dialogDismissHandler } from "@/lib/dialogDismiss";
import { toast } from "@/lib/toast";
import {
  exportBackup,
  importScopedData,
  readScopedImport,
  type ScopedBackup,
  type TransferScope,
} from "@/services/dataTransfer";

export function ScopedTransferActions({
  scope,
  compact = false,
}: {
  scope: TransferScope;
  compact?: boolean;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<ScopedBackup | null>(null);
  const [error, setError] = useState("");
  const label = t(scope === "calendar" ? "calendar_transfer" : "subscriptions_transfer");
  const run = async (action: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (err) {
      const key =
        err instanceof Error && err.message.startsWith("transfer_")
          ? err.message
          : "transfer_import_failed";
      setError(t(key));
      toast.error(t(key));
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <input
        ref={input}
        type="file"
        accept=".json,application/json"
        className="hidden"
        aria-label={`${label}: ${t("import")}`}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void run(async () => setSelected(await readScopedImport(file, scope)));
        }}
      />
      <Button
        type="button"
        variant="outline"
        size={compact ? "icon" : "default"}
        title={`${label}: ${t("import")}`}
        aria-label={`${label}: ${t("import")}`}
        disabled={busy}
        onClick={() => input.current?.click()}
        className={compact ? "h-11 w-11 rounded-xl" : "h-11 rounded-xl"}
      >
        <Upload className={compact ? "h-4 w-4" : "mr-2 h-4 w-4"} />
        {!compact && t("import")}
      </Button>
      <Button
        type="button"
        variant="outline"
        size={compact ? "icon" : "default"}
        title={`${label}: ${t("export")}`}
        aria-label={`${label}: ${t("export")}`}
        disabled={busy}
        onClick={() => void run(async () => exportBackup(() => {}, scope))}
        className={compact ? "h-11 w-11 rounded-xl" : "h-11 rounded-xl"}
      >
        <Download className={compact ? "h-4 w-4" : "mr-2 h-4 w-4"} />
        {!compact && t("export")}
      </Button>
      {selected && (
        <Dialog open onOpenChange={dialogDismissHandler(() => setSelected(null), busy)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{label}</DialogTitle>
              <DialogDescription>
                {t(scope === "calendar" ? "calendar_transfer_hint" : "subscriptions_transfer_hint")}
              </DialogDescription>
            </DialogHeader>
            <p className="text-sm">
              {t("transfer_record_count", {
                count:
                  selected.backup.data[scope === "calendar" ? "payment_records" : "subscriptions"]
                    .length,
              })}
            </p>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <DialogFooter>
              <Button variant="outline" disabled={busy} onClick={() => setSelected(null)}>
                {t("cancel")}
              </Button>
              <Button
                disabled={busy}
                onClick={() => {
                  void run(async () => {
                    const result = await importScopedData(selected);
                    await queryClient.invalidateQueries();
                    setSelected(null);
                    toast.success(
                      t("transfer_scope_result", {
                        imported: result.imported,
                        skipped: result.skipped,
                      }),
                    );
                  });
                }}
              >
                {t(busy ? "saving" : "import")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
