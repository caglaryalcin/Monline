import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { useLocalToday } from "@/hooks/useLocalToday";
import { creditCardClosings } from "@/lib/creditCardCalendar";
import { cardBankName, type CreditCard, creditCardLabel } from "@/lib/creditCards";
import { resolveLocale } from "@/lib/locale";
import { cn } from "@/lib/utils";

function dateString(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function CreditCardCalendar({ card, onEdit, disabled = false }: { card: CreditCard; onEdit: () => void; disabled?: boolean }) {
  const { t, i18n } = useTranslation();
  const today = useLocalToday();
  const [viewMonth, setViewMonth] = useState(today.slice(0, 7));
  const year = Number(viewMonth.slice(0, 4)), month = Number(viewMonth.slice(5));
  const locale = resolveLocale(i18n);
  const monthTitle = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(new Date(year, month - 1, 1, 12));
  const weekday = new Intl.DateTimeFormat(locale, { weekday: "short" });
  const shortDate = new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", weekday: "short" });
  const firstOffset = (new Date(year, month - 1, 1, 12).getDay() + 6) % 7;
  const days = new Date(year, month, 0, 12).getDate();
  const cells = Array.from({ length: Math.ceil((firstOffset + days) / 7) * 7 }, (_, index) => new Date(year, month - 1, index - firstOffset + 1, 12));
  const closings = creditCardClosings([card], year, month, true);
  const closingDates = new Set(closings.filter(event => event.kind === "closing").map(event => event.date));
  const dueDates = new Set(closings.filter(event => event.kind === "payment_due").map(event => event.date));
  const movedDates = new Set(closings.filter(event => event.date !== event.original_date).map(event => event.original_date));
  const navigate = (offset: number) => setViewMonth(dateString(new Date(year, month - 1 + offset, 1, 12)).slice(0, 7));
  return <section aria-label={`${t("credit_cards_statement_calendar")} · ${creditCardLabel(card)}`} className="w-full max-w-lg space-y-4 rounded-3xl border border-primary/20 bg-primary/10 p-4 sm:p-5">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-1">
        <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0" disabled={year <= 1970 && month === 1} aria-label={t("prev_month")} onClick={() => navigate(-1)}><ChevronLeft className="h-4 w-4" /></Button>
        <h3 className="text-sm font-semibold capitalize">{monthTitle}</h3>
        <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0" disabled={year >= 2200 && month === 12} aria-label={t("next_month")} onClick={() => navigate(1)}><ChevronRight className="h-4 w-4" /></Button>
      </div>
      <span className="text-xs font-medium">{cardBankName(card.bank)} · •••• {card.last_four}</span>
    </div>
    <table className="w-full table-fixed text-center text-xs" aria-label={`${monthTitle} · ${t("credit_cards_statement_day")}`}>
      <thead><tr>{Array.from({ length: 7 }, (_, index) => <th scope="col" key={index} className="pb-2 font-normal text-muted-foreground">{weekday.format(new Date(2024, 0, 1 + index, 12))}</th>)}</tr></thead>
      <tbody>{Array.from({ length: cells.length / 7 }, (_, row) => <tr key={row}>
        {cells.slice(row * 7, row * 7 + 7).map(date => {
          const value = dateString(date), closing = closingDates.has(value), due = dueDates.has(value), moved = movedDates.has(value);
          const otherMonth = date.getMonth() + 1 !== month;
          return <td key={value} className="py-0.5"><time dateTime={value} title={`${shortDate.format(date)}${closing ? ` · ${t("credit_cards_statement_day")}` : due ? ` · ${t("credit_cards_payment_due")}` : ""}`}
            aria-current={value === today ? "date" : undefined}
            className={cn("mx-auto flex h-9 max-w-[3.5rem] items-center justify-center rounded-xl", otherMonth && "text-muted-foreground/50", value === today && "ring-1 ring-inset ring-primary", due && "bg-white font-bold text-slate-900 ring-1 ring-inset ring-primary/30", closing && "bg-amber-300 font-bold text-amber-950", moved && !closing && !due && "bg-foreground/10 text-muted-foreground line-through")}>
            {date.getDate()}{(closing || due) && <span className="sr-only"> · {t(closing ? "credit_cards_statement_day" : "credit_cards_payment_due")}</span>}
          </time></td>;
        })}
      </tr>)}</tbody>
    </table>
    {card.statement_day ? <div className="space-y-2 text-xs">
      <div className="flex flex-wrap gap-x-4 gap-y-2"><p className="flex items-center gap-2"><span aria-hidden="true" className="h-2.5 w-2.5 rounded-sm bg-amber-300" />{t("credit_cards_statement_day")}</p>
        {dueDates.size > 0 && <p className="flex items-center gap-2"><span aria-hidden="true" className="h-2.5 w-2.5 rounded-sm bg-white ring-1 ring-inset ring-primary/30" />{t("credit_cards_payment_due")}</p>}
      </div>
      {closings.filter(event => event.date !== event.original_date).map(event => <p key={event.original_date} className="text-muted-foreground">{t("credit_cards_statement_shifted", { from: shortDate.format(new Date(`${event.original_date}T12:00:00`)), to: shortDate.format(new Date(`${event.date}T12:00:00`)) })}</p>)}
    </div> : <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground"><p>{t("credit_cards_statement_day_missing")}</p><Button type="button" size="sm" variant="outline" disabled={disabled} onClick={onEdit}>{t("credit_cards_statement_day_set")}</Button></div>}
  </section>;
}
