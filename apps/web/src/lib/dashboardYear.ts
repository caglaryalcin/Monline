import {
  getOccurrencesInMonth,
  getPaymentRecord,
  parseLocalDate,
  toDateStr,
} from "@/components/calendar/types";
import { type BudgetPeriod, budgetPeriodBounds } from "@/lib/budgetPeriod";
import { type FinanceData, percentChange, salaryAnalysis } from "@/lib/finance";
import { recordedPayments } from "@/lib/recordedPayments";
import { isCredit } from "@/lib/recordTypes";
import {
  isBillRecord,
  type SpendingData,
  spendingTotals,
  subscriptionSection,
} from "@/lib/spending";
import { type SavedStatement, STATEMENT_BANKS } from "@/lib/statements";
import { subscriptionAmount } from "@/lib/subscriptionTrial";
import type { Currency, PaymentRecord, Subscription } from "@/types";

export type DashboardPaymentSection = "cards" | "online" | "bills" | "loans";
export type DashboardStatement = Pick<SavedStatement, "id" | "period" | "summary"> &
  Partial<Pick<SavedStatement, "bank">>;
type PaymentItem = {
  date: string;
  amount: number;
  currency: string;
  name?: string;
  labelKey?: string;
  providerRowId?: string;
};
export interface DashboardPaymentGroup {
  items: PaymentItem[];
  upcoming: PaymentItem[];
  totals: { currency: string; amount: number }[];
  unpriced: number;
}

interface DashboardYearInput {
  finance: FinanceData;
  spending: SpendingData;
  subscriptions: Subscription[];
  currencies: Currency[];
  records: PaymentRecord[];
  statements?: DashboardStatement[];
  today: string;
  year?: number;
  periodMonths?: BudgetPeriod;
}

/** Minimums replace plans; months without a statement use the paid YTD mean. */
function forecastCardPayments(
  statements: DashboardStatement[],
  paid: PaymentItem[],
  planned: PaymentItem[],
  futureMonths: string[],
  currentMonth: string,
): PaymentItem[] {
  const minimums = new Map<string, PaymentItem[]>();
  const seenStatements = new Set<string>();
  for (const statement of statements) {
    if (
      seenStatements.has(statement.id) ||
      !/^\d{4}-(0[1-9]|1[0-2])$/.test(statement.period) ||
      statement.period > currentMonth
    )
      continue;
    seenStatements.add(statement.id);
    const amount = statement.summary?.minimum_payment;
    if (typeof amount !== "number" || !Number.isFinite(amount) || amount < 0) continue;
    const date = toDateStr(
      new Date(Number(statement.period.slice(0, 4)), Number(statement.period.slice(5, 7)), 1),
    );
    const month = date.slice(0, 7);
    if (!futureMonths.includes(month)) continue;
    const items = minimums.get(month) ?? [];
    items.push({
      date,
      amount,
      currency: "TRY",
      name: statement.bank ? STATEMENT_BANKS[statement.bank] : undefined,
      labelKey: "statement_summary_minimum_payment",
    });
    minimums.set(month, items);
  }

  // Count every elapsed calendar month, including months without a payment.
  const elapsedMonths = Number(currentMonth.slice(5, 7));
  const paidCents = paid.reduce((sum, item) => sum + Math.round(item.amount * 100), 0);
  const averageCents = paid.length ? Math.round(paidCents / elapsedMonths) : null;
  const byName = new Map<string, number>();
  for (const item of paid) {
    const name = item.name || "";
    byName.set(name, (byName.get(name) ?? 0) + Math.round(item.amount * 100));
  }
  const averages = [...byName]
    .map(([name, cents]) => ({
      name,
      cents: Math.floor(cents / elapsedMonths),
      remainder: cents % elapsedMonths,
    }))
    .sort((left, right) => right.remainder - left.remainder);
  // Split the existing monthly average by card without changing its total.
  const remainder = (averageCents ?? 0) - averages.reduce((sum, item) => sum + item.cents, 0);
  averages.forEach((item, index) => {
    if (index < remainder) item.cents++;
  });
  let result = [...planned];
  for (const month of futureMonths) {
    // Keep actual current-month plans; already-paid entries need no estimate.
    if (month === currentMonth && [...paid, ...planned].some((item) => item.date.startsWith(month)))
      continue;
    const replacement =
      minimums.get(month) ??
      (averageCents != null
        ? averages.map((item) => ({
            date: `${month}-01`,
            amount: item.cents / 100,
            currency: "TRY",
            name: item.name || undefined,
            labelKey: "finance_average",
          }))
        : null);
    if (!replacement) continue;
    result = result.filter((item) => !item.date.startsWith(month));
    result.push(...replacement);
  }
  return result;
}

/** Project one bill row at a time so separate phone lines stay separate. */
function forecastFixedBill(
  entries: { date: string; amount: number; status?: string }[],
  currency: string,
  futureMonths: string[],
  currentMonth: string,
): PaymentItem[] {
  const monthly = new Map<string, number>();
  for (const entry of entries) {
    if (!Number.isFinite(entry.amount) || entry.amount < 0) continue;
    const month = entry.date.slice(0, 7);
    monthly.set(month, (monthly.get(month) ?? 0) + Math.round(entry.amount * 100));
  }
  const latest = [...monthly]
    .filter(([month, cents]) => month <= currentMonth && cents > 0)
    .sort(([left], [right]) => right.localeCompare(left))[0];
  if (!latest) return [];
  return futureMonths
    .filter(
      (month) =>
        (monthly.get(month) ?? 0) <= 0 &&
        !(
          month === currentMonth &&
          entries.some((entry) => entry.date.startsWith(month) && entry.status === "settled")
        ),
    )
    .map((month) => ({ date: `${month}-01`, amount: latest[1] / 100, currency }));
}

/** Separate breakdowns: bills and online charges may be included in card repayments. */
export function dashboardYearPayments({
  finance,
  spending,
  subscriptions,
  currencies,
  records,
  statements = [],
  today,
  year: selectedYear,
  periodMonths,
}: DashboardYearInput) {
  const year = String(selectedYear ?? Number(today.slice(0, 4))),
    currentMonth = today.slice(0, 7);
  const bounds = periodMonths ? budgetPeriodBounds(today, periodMonths) : null;
  const inYear = (date: string) => /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    (bounds ? date >= bounds.from && date < bounds.until : date.startsWith(`${year}-`));
  const inPeriod = (date: string) => inYear(date) && (!!bounds || date.slice(0, 7) <= currentMonth);
  const inFuture = (date: string) =>
    inYear(date) && date.slice(0, 7) >= currentMonth && (!!bounds || year === today.slice(0, 4));
  const futureMonths = periodMonths
    ? Array.from({ length: periodMonths }, (_, offset) => {
        const month = new Date(Number(year), Number(today.slice(5, 7)) - 1 + offset, 1);
        return month.getFullYear() + "-" + String(month.getMonth() + 1).padStart(2, "0");
      })
    : year === today.slice(0, 4)
      ? Array.from(
          { length: 13 - Number(today.slice(5, 7)) },
          (_, index) => `${year}-${String(Number(today.slice(5, 7)) + index).padStart(2, "0")}`,
        )
      : [];
  const groups: Record<DashboardPaymentSection, PaymentItem[]> = {
    cards: [],
    online: [],
    bills: [],
    loans: [],
  };
  const upcoming: Record<DashboardPaymentSection, PaymentItem[]> = {
    cards: [],
    online: [],
    bills: [],
    loans: [],
  };
  const unpriced = { cards: 0, online: 0, bills: 0, loans: 0 };
  const add = (section: DashboardPaymentSection, item: PaymentItem, future = false) => {
    if (!Number.isFinite(item.amount) || item.amount < 0 || !/^[A-Z]{3}$/.test(item.currency)) {
      unpriced[section]++;
      return;
    }
    (future ? upcoming : groups)[section].push(item);
  };
  const rows = new Map(
    finance.finance_rows
      .filter((row) => !row.is_deleted && row.kind === "expense")
      .map((row) => [row.id, row]),
  );
  // The ledger month is authoritative. Bulk confirmation dates and calendar
  // moves must not shift years of historical amounts into the current month.
  for (const entry of finance.finance_entries) {
    const row = rows.get(entry.row_id);
    if (!row) continue;
    const section =
      row.expense_type === "credit_card"
        ? "cards"
        : row.is_loan
          ? "loans"
          : row.bill_type
            ? "bills"
            : null;
    if (!section) continue;
    const date = entry.date.slice(0, 10),
      item = {
        date,
        amount: entry.amount,
        currency: "TRY",
        name: row.name,
        providerRowId: row.origin_row || row.id,
      };
    if (entry.status === "settled" && inPeriod(date)) add(section, item);
    else if (entry.status === "planned" && inFuture(date)) add(section, item, true);
  }
  const billCandidates = spending.events.filter(
    (event) => event.source === "manual_bill" && isBillRecord(event) && !event.undated,
  );
  const billIds = new Set(billCandidates.map((event) => event.id));
  for (const event of billCandidates) {
    if (event.duplicate_of && billIds.has(event.duplicate_of)) continue;
    const date = event.date.slice(0, 10),
      item = {
        date,
        amount: event.amount,
        currency: event.currency,
        name: event.name,
        providerRowId: event.provider_row_id,
      };
    if (event.status === "settled" && inPeriod(date)) add("bills", item);
    else if (event.status === "planned" && inFuture(date)) add("bills", item, true);
  }
  const cardForecast = forecastCardPayments(
    statements,
    groups.cards,
    upcoming.cards,
    futureMonths,
    currentMonth,
  );

  upcoming.cards = [];
  for (const item of cardForecast) add("cards", item, true);

  // Fixed bills are estimated per row/series, never per bill tag: two phone
  // lines remain two charges. An explicit positive future amount wins.
  const projectFixedBill = (
    entries: { date: string; amount: number; status?: string }[],
    currency: string,
    name: string,
    providerRowId?: string,
  ) => {
    for (const item of forecastFixedBill(entries, currency, futureMonths, currentMonth)) {
      let displayName = name;
      if (periodMonths && providerRowId) {
        const sameMonth = (candidate: PaymentItem) => candidate.providerRowId === providerRowId && candidate.date.slice(0, 7) === item.date.slice(0, 7);
        // Future-year forks may already contain the actual bill. Never add an estimate over it.
        if (groups.bills.some(sameMonth) || upcoming.bills.some((candidate) => sameMonth(candidate) && candidate.amount > 0)) continue;
        const version = finance.finance_rows.find((row) => (row.origin_row || row.id) === providerRowId && row.year === Number(item.date.slice(0, 4)));
        if (version && (version.is_deleted || version.is_loan || version.expense_type === "credit_card" || !["internet", "mobile"].includes(version.bill_type || ""))) continue;
        displayName = version?.name || name;
      }
      add("bills", { ...item, name: displayName, providerRowId, labelKey: "dashboard_month_estimated" }, true);
    }
  };
  for (const row of rows.values()) {
    if (
      row.expense_type === "credit_card" ||
      row.is_loan ||
      !["internet", "mobile"].includes(row.bill_type ?? "")
    )
      continue;
    const entries = finance.finance_entries.filter((entry) => entry.row_id === row.id);
    if (row.year !== Number(year) && !entries.some((entry) => entry.date.startsWith(`${year}-`)))
      continue;
    projectFixedBill(entries, "TRY", row.name, row.origin_row || row.id);
  }
  const manualSeries = new Map<string, typeof billCandidates>();
  for (const event of billCandidates) {
    if (
      (event.duplicate_of && billIds.has(event.duplicate_of)) ||
      !["internet", "mobile"].includes(event.bill_type ?? "")
    )
      continue;
    const key = JSON.stringify([
      event.bill_type,
      event.currency,
      event.name.trim().toLocaleLowerCase(),
    ]);
    const entries = manualSeries.get(key) ?? [];
    entries.push(event);
    manualSeries.set(key, entries);
  }
  for (const entries of manualSeries.values())
    if (entries.some((entry) => entry.date.startsWith(`${year}-`)))
      projectFixedBill(entries, entries[0].currency, entries[0].name, entries[0].provider_row_id);
  // Match the subscriptions page, including paused subscriptions' paid history.
  const now = parseLocalDate(today)!;
  now.setHours(23, 59, 59, 999);
  const online = (subscription: Subscription) =>
    !isCredit(subscription) && ["online", "other"].includes(subscriptionSection(subscription));
  const currencyCode = (id: string, expanded?: Currency) =>
    currencies.find((item) => item.id === id)?.code ||
    expanded?.code ||
    (/^[A-Z]{3}$/.test(id) ? id : "");
  const seenSources = new Set<string>();
  for (const { record, subscription } of recordedPayments(
    subscriptions,
    currencies,
    records,
    now,
  )) {
    if (!online(subscription)) continue;
    const date = record.due_date.slice(0, 10);
    if (!inPeriod(date)) continue;
    const sources = record.statement_sources ?? [];
    if (sources.some((source) => seenSources.has(source))) continue;
    sources.forEach((source) => seenSources.add(source));
    const currencyId = record.currency || subscription.currency;
    const currency = currencyCode(
      currencyId,
      record.currency ? record.expand?.currency : subscription.expand?.currency,
    );
    if (typeof record.amount !== "number") {
      unpriced.online++;
      continue;
    }
    add("online", {
      date,
      amount: record.amount,
      currency,
      name: record.name || subscription.name,
    });
  }
  // Saved pending charges take precedence over the subscription's current
  // price. Project renewals only inside the active schedule and lifetime.
  for (const subscription of subscriptions.filter(online)) {
    const saved = records.filter((record) => record.subscription_id === subscription.id);
    const dates = new Set(
      saved
        .filter((record) => inFuture(record.due_date.slice(0, 10)))
        .map((record) => record.due_date.slice(0, 10)),
    );
    if (!subscription.inactive && year === today.slice(0, 4)) {
      // Imported history hides calendar projections to avoid duplicate events.
      // That presentation flag must not hide an active subscription's forecast.
      const schedule = { ...subscription, calendar_projection_hidden: false };
      for (let month = Number(today.slice(5, 7)); month <= 12; month++) {
        for (const occurrence of getOccurrencesInMonth(
          schedule,
          Number(year),
          month,
          [],
          records,
        )) {
          const date = toDateStr(occurrence);
          // auto_renew controls processing; an active recurring subscription
          // still has its normal calendar schedule when it is paid manually.
          dates.add(date);
        }
      }
    }
    for (const date of dates) {
      const record = getPaymentRecord(saved, subscription.id, date);
      if (record?.paid_at) continue;
      const currencyId = record?.currency || subscription.currency;
      add(
        "online",
        {
          date,
          name: subscription.name,
          amount: record?.amount ?? subscriptionAmount(subscription, date),
          currency: currencyCode(
            currencyId,
            record?.currency ? record.expand?.currency : subscription.expand?.currency,
          ),
        },
        true,
      );
    }
  }
  return Object.fromEntries(
    (Object.keys(groups) as DashboardPaymentSection[]).map((section) => [
      section,
      {
        items: groups[section],
        upcoming: upcoming[section],
        totals: spendingTotals(groups[section]),
        unpriced: unpriced[section],
      },
    ]),
  ) as Record<DashboardPaymentSection, DashboardPaymentGroup>;
}

/** Full calendar year, with forecasts separate from confirmed monthly totals. */
export function dashboardPaymentHistory(
  group: DashboardPaymentGroup,
  year: number,
  currency: string,
  today: string,
) {
  const sum = (items: PaymentItem[], month: string) => {
    const matching = items.filter(
      (item) => item.date.startsWith(month) && item.currency === currency,
    );
    return matching.length
      ? matching.reduce((total, item) => total + Math.round(item.amount * 100), 0) / 100
      : null;
  };
  const points = Array.from({ length: 12 }, (_, index) => {
    const month = `${year}-${String(index + 1).padStart(2, "0")}`;
    const paidTotal = sum(group.items, month);
    const upcomingTotal = sum(group.upcoming, month);
    const payments = group.items
      .filter((item) => item.date.startsWith(month) && item.currency === currency)
      .flatMap((item) => (item.name ? [{ name: item.name, amount: item.amount }] : []));
    const upcomingPayments = group.upcoming
      .filter((item) => item.date.startsWith(month) && item.currency === currency)
      .map((item) => ({ name: item.name, labelKey: item.labelKey, amount: item.amount }));
    // An unfinished month has one expected total, rather than two competing
    // chart points. Keep the actual paid/pending amounts for the tooltip.
    return {
      month,
      value: upcomingTotal == null ? paidTotal : null,
      forecast:
        upcomingTotal == null
          ? null
          : (Math.round((paidTotal ?? 0) * 100) + Math.round(upcomingTotal * 100)) / 100,
      paidTotal,
      upcomingTotal,
      isForecast: upcomingTotal != null,
      payments,
      upcomingPayments,
    };
  });
  // Join each upcoming segment to the immediately preceding paid month.
  // The anchor is only visual; it stays out of upcoming totals and tooltips.
  for (let index = 1; index < points.length; index++) {
    const point = points[index];
    const previous = points[index - 1];
    if (
      point.isForecast &&
      point.month >= today.slice(0, 7) &&
      previous.forecast == null &&
      previous.value != null
    )
      previous.forecast = previous.value;
  }
  return points;
}

export function dashboardYearSalary(data: FinanceData, today: string) {
  const year = Number(today.slice(0, 4));
  const months = salaryAnalysis(data, year).filter((month) => month.month <= today.slice(0, 7));
  const recorded = months.filter((month) => month.salary != null);
  const baseline = months.find((month) => month.month === `${year}-01` && month.salary != null);
  const latest = recorded.at(-1);
  return {
    months,
    baseline,
    latest,
    change: baseline && latest ? percentChange(latest.salary, baseline.salary) : null,
  };
}
