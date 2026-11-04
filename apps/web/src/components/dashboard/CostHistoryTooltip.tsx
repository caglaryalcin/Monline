import { Check, Clock3 } from "lucide-react";
import { useTranslation } from "react-i18next";

import { historyMonth } from "@/lib/costHistory";
import type { CostHistoryPaymentMonth } from "@/lib/costHistoryPayments";

export function CostHistoryTooltip({
  month,
  details,
  formatValue,
  language,
}: {
  month: string;
  details: CostHistoryPaymentMonth;
  formatValue: (amount: number) => string;
  language: string;
}) {
  const { t } = useTranslation();
  const groups = [
    {
      key: "paid",
      label: t("budget_paid"),
      items: details.paid,
      Icon: Check,
      tone: "text-green-700 dark:text-green-400",
    },
    {
      key: "pending",
      label: t("budget_pending"),
      items: details.pending,
      Icon: Clock3,
      tone: "text-amber-700 dark:text-amber-400",
    },
  ];
  const dateLabel = (date: string) =>
    new Intl.DateTimeFormat(language.replace("_", "-"), {
      day: "numeric",
      month: "short",
    }).format(new Date(`${date}T12:00:00`));
  return (
    <div
      role="tooltip"
      className="monline-scroll max-h-72 w-80 max-w-[80vw] space-y-3 overflow-y-auto overscroll-contain rounded-xl border bg-card p-4 text-xs shadow-lg"
      onMouseMove={(event) => event.stopPropagation()}
    >
      <p className="font-semibold">{historyMonth(month, language, true)}</p>
      {groups.map(({ key, label, items, Icon, tone }) => (
        <section key={key} className="space-y-2" aria-label={label}>
          <div
            className={`flex items-center justify-between gap-4 border-b pb-1.5 font-semibold ${tone}`}
          >
            <span className="inline-flex items-center gap-1.5">
              <Icon className="h-3.5 w-3.5" />
              {label}
            </span>
            <span className="whitespace-nowrap tabular-nums">
              {formatValue(
                items.reduce((sum, item) => sum + Math.round(item.amount * 100), 0) / 100,
              )}
            </span>
          </div>
          {items.length ? (
            <ul className="space-y-2">
              {items.map((payment) => (
                <li key={payment.id} className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="break-words font-medium">{payment.name}</p>
                    <p className={payment.overdue ? "text-destructive" : "text-muted-foreground"}>
                      {dateLabel(payment.date)}
                      {payment.overdue ? ` · ${t("budget_status_overdue")}` : ""}
                    </p>
                  </div>
                  <span className="shrink-0 whitespace-nowrap font-semibold tabular-nums">
                    {formatValue(payment.amount)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground">-</p>
          )}
        </section>
      ))}
    </div>
  );
}
