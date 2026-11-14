import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarOff, Undo2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import type { SpendingEvent } from "@/lib/spending";
import { billsService } from "@/services/bills";

export function BillMonthStatusAction({ bill, compact = false }: { bill: SpendingEvent; compact?: boolean }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: () => billsService.setMonthSkipped(
      bill.source === "ledger" ? "ledger" : "manual_bill",
      bill.manual_bill_id || bill.id.slice("ledger:".length),
      bill.date,
      !bill.bill_skipped,
    ),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["spending", user?.id] }),
        queryClient.invalidateQueries({ queryKey: ["finance", user?.id] }),
        queryClient.invalidateQueries({ queryKey: ["budget"] }),
      ]);
    },
  });
  if (bill.status !== "planned" || bill.payment_record_id || bill.verification ||
      (!bill.bill_skipped && bill.amount !== 0) ||
      !["ledger", "manual_bill"].includes(bill.source)) return null;
  const Icon = bill.bill_skipped ? Undo2 : CalendarOff;
  const label = t(bill.bill_skipped ? "spending_bill_skip_undo" : "spending_bill_skip");
  return (
    <div className="flex min-w-0 max-w-full flex-col items-end gap-1">
      <Button
        variant={compact ? "ghost" : "outline"}
        size={compact ? "icon" : "sm"}
        className={compact
          ? "h-5 w-5 shrink-0 rounded-md text-muted-foreground"
          : "h-auto min-h-9 max-w-full gap-1.5 whitespace-normal rounded-lg px-3 py-2 text-left text-xs leading-snug"}
        disabled={mutation.isPending}
        aria-label={`${label} · ${bill.name}`}
        title={`${label} · ${t("spending_bill_skip_help")}`}
        onClick={() => mutation.mutate()}
      >
        <Icon className={compact ? "h-3.5 w-3.5 shrink-0" : "h-4 w-4 shrink-0"} aria-hidden="true" />
        {!compact && <span>{label}</span>}
      </Button>
      {mutation.isError && (
        <p role="alert" className="max-w-56 px-2 text-xs text-destructive">
          {t("spending_bill_skip_failed")}
        </p>
      )}
    </div>
  );
}
