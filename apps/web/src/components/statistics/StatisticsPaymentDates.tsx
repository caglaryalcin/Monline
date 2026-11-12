import { useTranslation } from "react-i18next";

import { formatDate } from "@/lib/utils";

export function StatisticsPaymentDates({
  dates,
  language,
  upcoming,
  label: labelOverride,
}: {
  dates?: string[];
  language: string;
  upcoming: boolean;
  label?: string;
}) {
  const { t } = useTranslation();
  if (!dates?.length) return null;
  const counts = new Map<string, number>();
  for (const date of dates) counts.set(date, (counts.get(date) ?? 0) + 1);
  const label =
    labelOverride ??
    t(upcoming ? "statistics_scheduled_payment_dates" : "statistics_payment_dates");

  return (
    <div className="mt-2 flex items-start gap-2">
      <p className="shrink-0 text-xs leading-6 text-muted-foreground">{label}:</p>
      <ul className="flex min-w-0 flex-1 flex-wrap gap-1" aria-label={label}>
        {[...counts]
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([date, count]) => (
            <li
              key={date}
              className="inline-flex items-center gap-1 rounded-md border bg-background px-1.5 py-0.5 text-xs text-muted-foreground"
            >
              <time dateTime={date}>{formatDate(date, language)}</time>
              {count > 1 && <span aria-label={t("payments_count", { count })}>×{count}</span>}
            </li>
          ))}
      </ul>
    </div>
  );
}
