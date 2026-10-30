import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { SpendingEvent } from "@/lib/spending";
import { billsService } from "@/services/bills";

import { ManualBillDialog } from "./ManualBillDialog";

export function ManualBillActions({
  bill,
  onChanged,
  compact = false,
}: {
  bill: SpendingEvent;
  onChanged?: () => void;
  compact?: boolean;
}) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const queryClient = useQueryClient();
  const remove = useMutation({
    mutationFn: () => billsService.remove(bill.manual_bill_id!),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["spending"] });
      onChanged?.();
    },
  });
  return (
    <div className={compact ? "flex flex-wrap items-center gap-1" : "flex flex-wrap items-center gap-2"}>
      <Button
        size={compact ? "icon" : "sm"}
        variant="ghost"
        className={compact ? "h-8 w-8 text-muted-foreground hover:text-foreground" : undefined}
        title={compact ? t("spending_edit_bill") : undefined}
        aria-label={compact ? `${t("spending_edit_bill")} · ${bill.name}` : undefined}
        disabled={remove.isPending}
        onClick={() => setEditing(true)}
      >
        {compact ? <Pencil className="h-4 w-4" aria-hidden="true" /> : t("spending_edit_bill")}
      </Button>
      <Button
        size={compact ? "icon" : "sm"}
        variant="ghost"
        className={compact ? "h-8 w-8 text-muted-foreground hover:text-destructive" : undefined}
        title={compact ? t("spending_delete_bill") : undefined}
        aria-label={compact ? `${t("spending_delete_bill")} · ${bill.name}` : undefined}
        disabled={remove.isPending}
        onClick={() => setDeleting(true)}
      >
        {compact ? <Trash2 className="h-4 w-4" aria-hidden="true" /> : t("spending_delete_bill")}
      </Button>
      {remove.isError && (
        <p role="alert" className="text-sm text-destructive">
          {t("spending_bill_failed")}
        </p>
      )}
      {editing && (
        <ManualBillDialog
          month={bill.date.slice(0, 7)}
          bill={bill}
          onClose={() => setEditing(false)}
          onSaved={onChanged}
        />
      )}
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={t("spending_delete_bill")}
        description={t("spending_delete_bill_help")}
        onConfirm={() => remove.mutate()}
      />
    </div>
  );
}
