import { type FinanceData, financeMonths, financeRowsForYear, isFinanceDeficitRow, sumEntries } from "@/lib/finance";
import { isExpense } from "@/lib/recordTypes";
import { type SpendingEvent, subscriptionSection } from "@/lib/spending";
import type { Currency } from "@/types";

import type { DayEntry } from "./types";
import { toDateStr, toMain } from "./types";

// Match the online subscriptions section, including subscriptions without a
// recognized provider. Independent payments remain part of the normal total.
function isOnlineSubscription(entry: DayEntry) {
  return !entry.spending && !entry.sub.standalone_payment_id && isExpense(entry.sub) &&
    ["online", "other"].includes(subscriptionSection(entry.sub));
}

/** Card purchases are details of the card bill, rather than a second payment. */
export function calendarAmounts(events: SpendingEvent[], currencies: Currency[], finance?: FinanceData) {
  const deficitRows = new Set(finance?.finance_rows.filter(isFinanceDeficitRow).map((row) => row.id));
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
      event.kind === "carryover" ||
      (event.source === "ledger" && !!event.row_id && deficitRows.has(event.row_id)) ||
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
  const subscriptionCents = (entry: DayEntry) => convert(
    entry.amount ?? entry.sub.price,
    currencies.find((currency) => currency.id === entry.sub.currency) ??
      entry.sub.expand?.currency,
  );
  const entryCents = (entry: DayEntry) => {
    if (entry.spending) return spendingCents(entry.spending);
    if (
      !isExpense(entry.sub) ||
      coveredCard(
        entry.sub.expand?.payment_method?.finance_card,
        toDateStr(entry.date).slice(0, 7),
      )
    )
      return null;
    return subscriptionCents(entry);
  };
  return {
    spendingCents,
    entryCents,
    // Online subscription charges are displayed independently, even when the
    // selected month also contains the card bill covering those charges.
    subscriptionCents: (entry: DayEntry) => isOnlineSubscription(entry) ? subscriptionCents(entry) : null,
    overviewCents: (entry: DayEntry) => isOnlineSubscription(entry) ? null : entryCents(entry),
  };
}

/** Use the same carried cash deficit as Income / Expenses, rather than summing
 * historical deficit rows again. Ledger amounts are stored in TRY.
 */
export function calendarCarryover(
  data: FinanceData | undefined,
  currencies: Currency[],
  year: number,
  month: number,
) {
  if (!data) return null;
  const amount = financeMonths(data, year)[month - 1]?.carryover ?? 0;
  if (!amount) return 0;
  const currency = currencies.find((currency) => currency.code === "TRY");
  if (!currency || (!currency.is_main && !(currency.rate > 0))) return null;
  return Math.round(toMain(amount, currency) * 100) / 100;
}

/** All salary and other income in the selected ledger month, received or planned.
 * An entered month without income has a zero total; missing data stays unknown.
 */
export function calendarIncome(
  data: FinanceData | undefined,
  currencies: Currency[],
  year: number,
  month: number,
) {
  if (!data) return null;
  const incomeRows = new Set(
    financeRowsForYear(data.finance_rows, year, data)
      .filter((row) => row.kind === "salary" || row.kind === "income")
      .map((row) => row.id),
  );
  const period = `${year}-${String(month).padStart(2, "0")}`;
  const entries = data.finance_entries.filter(
    (entry) => incomeRows.has(entry.row_id) && entry.date.slice(0, 7) === period,
  );
  const amount = sumEntries(entries);
  if (!amount) return 0;
  const currency = currencies.find((currency) => currency.code === "TRY");
  if (!currency || (!currency.is_main && !(currency.rate > 0))) return null;
  return Math.round(toMain(amount, currency) * 100) / 100;
}
