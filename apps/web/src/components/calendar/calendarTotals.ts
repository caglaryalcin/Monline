import { type FinanceData,financeRowsForYear, sumEntries } from "@/lib/finance";
import { isExpense } from "@/lib/recordTypes";
import type { SpendingEvent } from "@/lib/spending";
import type { Currency } from "@/types";

import type { DayEntry } from "./types";
import { toDateStr, toMain } from "./types";

/** Card purchases are details of the card bill, rather than a second payment. */
export function calendarAmounts(events: SpendingEvent[], currencies: Currency[]) {
  const cardMonths = new Set<string>();
  const statements = new Set<string>();
  for (const event of events) {
    if (event.source !== "ledger" || event.kind !== "card_payment" || event.duplicate_of) continue;
    const month = event.date.slice(0, 7);
    for (const id of [event.row_id, event.provider_row_id])
      if (id) cardMonths.add(`${id}:${month}`);
    if (event.statement_id) statements.add(event.statement_id);
  }
  const coveredCard = (card: string | undefined, month: string) =>
    !!card && cardMonths.has(`${card}:${month}`);
  const coveredPurchase = (event: SpendingEvent) =>
    (event.source === "statement" || event.source === "manual_card") &&
    ((!!event.statement_id && statements.has(event.statement_id)) ||
      coveredCard(event.card_row_id, event.statement_period || event.date.slice(0, 7)));
  const convert = (amount: number, currency?: Currency) =>
    Number.isFinite(amount) && currency && (currency.is_main || currency.rate > 0)
      ? Math.round(toMain(amount, currency) * 100)
      : null;
  const spendingCents = (event: SpendingEvent) => {
    if (
      event.duplicate_of ||
      coveredPurchase(event) ||
      (event.counts_as_expense === false &&
        !(event.source === "ledger" && event.kind === "card_payment"))
    )
      return null;
    return convert(
      event.amount,
      currencies.find((currency) => currency.code === event.currency),
    );
  };
  return {
    spendingCents,
    entryCents(entry: DayEntry) {
      if (entry.spending) return spendingCents(entry.spending);
      if (
        !isExpense(entry.sub) ||
        coveredCard(
          entry.sub.expand?.payment_method?.finance_card,
          toDateStr(entry.date).slice(0, 7),
        )
      )
        return null;
      return convert(
        entry.amount ?? entry.sub.price,
        currencies.find((currency) => currency.id === entry.sub.currency) ??
          entry.sub.expand?.currency,
      );
    },
  };
}

/** Finance amounts are TRY; use the selected month's salary entries, including planned salary. */
export function calendarSalary(
  data: FinanceData | undefined,
  currencies: Currency[],
  year: number,
  month: number,
) {
  if (!data) return null;
  const salaryRows = new Set(
    financeRowsForYear(data.finance_rows, year, data)
      .filter((row) => row.kind === "salary")
      .map((row) => row.id),
  );
  const period = `${year}-${String(month).padStart(2, "0")}`;
  const entries = data.finance_entries.filter(
    (entry) => salaryRows.has(entry.row_id) && entry.date.slice(0, 7) === period,
  );
  const currency = currencies.find((currency) => currency.code === "TRY");
  if (!entries.length || !currency || (!currency.is_main && !(currency.rate > 0))) return null;
  return Math.round(toMain(sumEntries(entries), currency) * 100) / 100;
}
