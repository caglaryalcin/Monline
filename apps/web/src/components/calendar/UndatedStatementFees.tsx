import { useTranslation } from "react-i18next";

import { StatementLink } from "@/components/StatementLink";
import type { SpendingEvent } from "@/lib/spending";
import { formatCurrency } from "@/lib/utils";

export function UndatedStatementFees({ events }: { events: SpendingEvent[] }) {
  const { t, i18n } = useTranslation();
  if (!events.length) return null;
  return (
    <section className="space-y-2 rounded-xl border p-4 text-sm">
      <h2 className="font-semibold">{t("spending_undated_fees")}</h2>
      <p className="text-xs text-muted-foreground">{t("spending_undated_help")}</p>
      {events.map((event) => (
        <div key={event.id} className="flex flex-wrap justify-between gap-3">
          <span>
            {event.card_name || event.statement_period} · {t("statement_category_fees")}
          </span>
          <span className="font-medium tabular-nums">
            {formatCurrency(event.amount, event.currency, { locale: i18n.language.replace("_", "-") })}
          </span>
          {event.statement_id && (
            <StatementLink statementId={event.statement_id} className="text-primary underline">
              {t("finance_go_statement")}
            </StatementLink>
          )}
        </div>
      ))}
    </section>
  );
}
