import { useTranslation } from "react-i18next";

import { CALENDAR_PAYMENT_TONES, paymentTone } from "./paymentAppearance";

export function CalendarPaymentLegend({ hasStatementDays = false, hasDueDays = false }: { hasStatementDays?: boolean; hasDueDays?: boolean }) {
  const { t } = useTranslation();
  return (
    <div className="shrink-0 border-t px-3 py-2 sm:px-4">
      <div
        role="group"
        aria-label={t("calendar_color_legend")}
        className="grid grid-cols-2 gap-1.5 lg:grid-cols-4"
      >
        {hasStatementDays && <div className="flex min-h-7 items-center gap-2 rounded-md border border-amber-400/40 bg-amber-100 px-2 py-1 text-[11px] leading-tight text-amber-950 dark:border-amber-400/30 dark:bg-amber-400/15 dark:text-amber-200"><span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-sm bg-amber-300" />{t("credit_cards_statement_day")}</div>}
        {hasDueDays && <div className="flex min-h-7 items-center gap-2 rounded-md border border-primary/30 bg-white px-2 py-1 text-[11px] leading-tight text-slate-900"><span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-sm bg-white ring-1 ring-inset ring-primary/40" />{t("credit_cards_payment_due")}</div>}
        {CALENDAR_PAYMENT_TONES.map((tone) => {
          const appearance = paymentTone(tone);
          return (
            <div
              key={tone}
              className={`${appearance.className} flex min-h-7 items-center rounded-md border px-2 py-1 text-[11px] leading-tight`}
            >
              <span>{t(appearance.labelKey)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
