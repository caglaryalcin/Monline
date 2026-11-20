import { useQuery } from "@tanstack/react-query";
import { Banknote, CalendarClock, CreditCard, Landmark, ShoppingBag, TrendingUp } from "lucide-react";
import { lazy, type ReactNode, Suspense, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { AffordabilityComparisons } from "@/components/affordability/AffordabilityComparisons";
import { CurrencyLabel } from "@/components/CurrencyLabel";
import { PageLoading } from "@/components/PageLoading";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CurrencyInput } from "@/components/ui/currency-input";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ThemedSelect } from "@/components/ui/themed-select";
import { useAuth } from "@/contexts/AuthContext";
import { useLocalToday } from "@/hooks/useLocalToday";
import { useNumberLocale } from "@/hooks/useNumberLocale";
import {
  affordabilityLedgerMonths,   type AffordabilityMethod, amountIsValid, inferredCardDue, inferredCardSchedule, type OutlookLedger, type PurchasePlan, type PurchaseScenario,
shiftPurchaseDate, simulatePurchase, validPurchaseDate,
} from "@/lib/affordability";
import { type CreditCard as SavedCard,creditCardLabel } from "@/lib/creditCards";
import { displayDateInput } from "@/lib/dateInput";
import { resolveLocale } from "@/lib/locale";
import { isSavingsCurrency, type Saving, type SavingsRates, savingsUnitRate, savingsValue } from "@/lib/savings";
import { cn, formatCurrency } from "@/lib/utils";
import { affordabilityService } from "@/services/affordability";
import { savingsRatesKey, savingsRatesRefetchInterval, savingsService } from "@/services/savings";

const methods = [
  { key: "cash", icon: Banknote }, { key: "card", icon: CreditCard }, { key: "loan", icon: Landmark },
] as const;
const AffordabilityChart = lazy(() => import("@/components/affordability/AffordabilityChart"));
const statusKey = (status: PurchaseScenario["status"]) => `aff_${status === "limit" ? "limit_status" : status}`;
const statusColor = (status: PurchaseScenario["status"]) => status === "comfortable" ? "text-emerald-600 dark:text-emerald-400"
  : status === "tight" ? "text-amber-600 dark:text-amber-400" : status === "shortfall" || status === "limit" ? "text-destructive" : "text-muted-foreground";

function Field({ label, id, children, hint }: { label: string; id: string; children: ReactNode; hint?: string }) {
  return <div className="min-w-0 space-y-2"><Label htmlFor={id}>{label}</Label>{children}
    {hint && <p className="text-xs text-muted-foreground">{hint}</p>}</div>;
}
function MoneyField({ id, label, value, onChange, currency, hint }: {
  id: string; label: string; value: number | null; onChange: (value: number | null) => void; currency: string; hint?: string;
}) {
  return <Field label={label} id={id} hint={hint}><CurrencyInput id={id} value={value} code={currency}
    onChange={onChange} onEmpty={() => onChange(null)} groupWhileEditing /></Field>;
}

export function AffordabilityPage() {
  const { user } = useAuth();
  return user ? <AffordabilityWorkspace key={user.id} userId={user.id} mainCurrencyId={user.main_currency || ""} /> : null;
}

function AffordabilityWorkspace({ userId, mainCurrencyId }: { userId: string; mainCurrencyId: string }) {
  const { t } = useTranslation();
  const today = useLocalToday();
  const [selectedCurrency, setCurrency] = useState<string | null>(null);
  const snapshot = useQuery({ queryKey: ["affordability", userId, today],
    queryFn: ({ signal }) => affordabilityService.snapshot(signal), staleTime: 0, retry: false });
  const rates = useQuery({ queryKey: savingsRatesKey(userId), queryFn: savingsService.rates,
    staleTime: 15000, refetchInterval: savingsRatesRefetchInterval });
  const data = snapshot.data;
  const currencies = data?.currencies || [];
  const main = currencies.find(item => item.is_main) || currencies.find(item => item.id === mainCurrencyId);
  const currency = selectedCurrency || main?.code.toUpperCase() || "TRY";
  const options = [...new Set(["TRY", "USD", "EUR", "GBP", currency,
    ...currencies.map(item => item.code.toUpperCase()),
    ...Object.keys(rates.data?.currency_rates || {}).filter(isSavingsCurrency)])];
  return <div className="space-y-5 pb-5">
    <header className="flex flex-wrap items-start justify-between gap-4 rounded-2xl bg-gradient-to-br from-emerald-900 to-teal-800 p-6 text-white">
      <div className="max-w-2xl space-y-2"><p className="flex items-center gap-2 text-sm font-semibold text-amber-300"><ShoppingBag className="h-4 w-4" />{t("finance_workspace_affordability")}</p>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("aff_title")}</h1><p className="text-sm leading-relaxed text-emerald-50/90">{t("aff_intro")}</p></div>
      <div className="w-36 space-y-2"><Label htmlFor="aff-currency">{t("aff_currency")}</Label>
        <Select value={currency} onValueChange={setCurrency}><SelectTrigger id="aff-currency" className="border-white/30 bg-white/10 text-white"><SelectValue /></SelectTrigger>
          <SelectContent>{options.map(code => <SelectItem key={code} value={code}><CurrencyLabel code={code} /></SelectItem>)}</SelectContent></Select></div>
    </header>
    {snapshot.isError || snapshot.fetchStatus === "paused" ? <Card><CardContent className="space-y-3 pt-6"><p role="alert">{t("aff_error")}</p>
      <Button variant="outline" onClick={() => void snapshot.refetch()}>{t("aff_retry")}</Button>
    </CardContent></Card> : data ? <Simulator key={`${currency}:${today}`} currency={currency} today={today} ledger={data.ledger}
      holdings={data.holdings} cards={data.cards} rates={rates.data} /> : <PageLoading />}
  </div>;
}

interface SimulatorProps {
  currency: string; today: string; ledger: OutlookLedger; holdings: Saving[];
  cards: SavedCard[]; rates?: SavingsRates;
}
function Simulator({ currency, today, ledger, holdings, cards, rates }: SimulatorProps) {
  const { t, i18n } = useTranslation();
  const locale = useNumberLocale();
  const dateLocale = resolveLocale(i18n);
  const money = (value: number) => formatCurrency(value, currency, { locale });
  const monthLabel = (month: string) => month ? new Intl.DateTimeFormat(dateLocale, { month: "short", year: "numeric" }).format(new Date(`${month}-01T12:00:00Z`)) : t("aff_none");
  const fullMonthLabel = (month: string) => new Intl.DateTimeFormat(dateLocale, { month: "long", year: "numeric" }).format(new Date(`${month}-01T12:00:00Z`));
  const dateLabel = (date: string) => date ? displayDateInput(date) : t("aff_none");
  const [name, setName] = useState("");
  const [price, setPrice] = useState<number | null>(null);
  const [date, setDate] = useState(today);
  const [method, setMethod] = useState<AffordabilityMethod>("cash");
  const [cardId, setCardId] = useState("");
  const [installments, setInstallments] = useState(6);
  const [cardFee, setCardFee] = useState<number | null>(0);
  const [cardLimit, setCardLimit] = useState<number | null>(null);
  const [cardDueOverride, setCardDue] = useState<string | null>(null);
  const [loanMonths, setLoanMonths] = useState(12);
  const [loanPayment, setLoanPayment] = useState<number | null>(null);
  const [loanDueOverride, setLoanDue] = useState<string | null>(null);
  const [selectedAssets, setSelectedAssets] = useState<string[] | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const resultRef = useRef<HTMLElement>(null);
  const card = cards.find(item => item.id === cardId);
  const autoCardDue = inferredCardDue(card, date);
  const cardDue = cardDueOverride ?? autoCardDue;
  const loanDue = loanDueOverride ?? shiftPurchaseDate(date, 1);
  const selected = selectedAssets ?? holdings.filter(item => item.asset === "TRY").map(item => item.id);
  const usesExchangeRates = currency !== "TRY" || holdings.some(item => selected.includes(item.id) && item.asset !== currency);
  const ratesTimestamp = rates?.as_of || rates?.fetched_at;
  const ratesDate = ratesTimestamp && Number.isFinite(Date.parse(ratesTimestamp))
    ? new Intl.DateTimeFormat(dateLocale, { dateStyle: "short", timeStyle: "short" }).format(new Date(ratesTimestamp)) : t("aff_none");
  const values = holdings.filter(item => selected.includes(item.id)).map(item => savingsValue(item, rates, currency));
  const selectedTotal = values.some(value => value === null) ? null : Math.round(values.reduce<number>((sum, value) => sum + (value || 0), 0) * 100) / 100;
  const opening = selectedTotal;
  const firstPayment = method === "cash" ? date : method === "card" ? cardDue : loanDue;
  const startMonth = validPurchaseDate(firstPayment) && firstPayment >= today ? firstPayment.slice(0, 7) : today.slice(0, 7);
  const endMonth = shiftPurchaseDate(`${startMonth}-01`, 6).slice(0, 7);
  const forecastMonths = useMemo(() => {
    const result: string[] = [];
    for (let month = today.slice(0, 7); month && month < endMonth; month = shiftPurchaseDate(`${month}-01`, 1).slice(0, 7)) result.push(month);
    return result;
  }, [today, endMonth]);
  const ledgerRate = savingsUnitRate("TRY", rates, currency);
  const ledgerMonths = useMemo(() => {
    const convert = (value: number) => ledgerRate === null ? null : Math.round(value * ledgerRate * 100) / 100;
    return affordabilityLedgerMonths(ledger, forecastMonths, today).map(item => ({
      ...item, total: convert(item.total), paid: convert(item.paid), pending: convert(item.pending),
      income: convert(item.income), expense: convert(item.expense),
    }));
  }, [ledger, forecastMonths, ledgerRate, today]);
  const ledgerExpenseMonths = ledgerMonths.filter(item => item.month >= startMonth);
  const months = ledgerMonths.map(item => ({ month: item.month, income: item.income, expense: item.expense }));
  const cashFlowsByMonth = new Map(months.map(item => [item.month, item]));
  const totalLedgerExpenses = ledgerExpenseMonths.every(item => amountIsValid(item.total))
    ? Math.round(ledgerExpenseMonths.reduce((sum, item) => sum + (item.total || 0), 0) * 100) / 100 : null;
  const readyBudget = amountIsValid(opening) && ledgerExpenseMonths.length === 6 && months.every(item => amountIsValid(item.income) && amountIsValid(item.expense));
  const plan: PurchasePlan = { method, price: price ?? 0, date, installments, cardFee: cardFee ?? NaN, cardLimit, cardDue,
    cardDates: cardDueOverride === null ? inferredCardSchedule(card, date, installments) : undefined,
    loanMonths, loanPayment, loanFee: 0, loanDue };
  const snapshot = JSON.stringify({ months, opening, startMonth, plan });
  const confirmed = readyBudget && confirmation === snapshot;
  const preview = simulatePurchase(months, method === "card" && !card ? null : opening, 0, plan, today, startMonth);
  const canCalculate = readyBudget && preview.points.length > 0;
  const budgetPrompt = !amountIsValid(price) || price <= 0 ? t("aff_need_price")
    : !amountIsValid(opening) ? t("aff_rates_missing")
    : ledgerRate === null ? t("aff_ledger_rates_missing")
    : !canCalculate ? t(preview.status === "limit" ? "aff_limit_status" : "aff_need_purchase") : t("aff_ready");
  const calculate = (option: AffordabilityMethod, wait = 0): PurchaseScenario => {
    const delayed = { ...plan, method: option, date: shiftPurchaseDate(date, wait),
      cardDates: cardDueOverride === null ? inferredCardSchedule(card, shiftPurchaseDate(date, wait), installments) : undefined,
      cardDue: wait ? (cardDueOverride === null ? inferredCardDue(card, shiftPurchaseDate(date, wait)) : shiftPurchaseDate(cardDue, wait)) : cardDue,
      loanDue: wait ? shiftPurchaseDate(loanDue, wait) : loanDue };
    return simulatePurchase(months, confirmed && (option !== "card" || !!card) ? opening : null, 0, delayed, today, startMonth);
  };
  const result = calculate(method);
  const comparisons = [...methods.map(option => ({ id: option.key, icon: option.icon, label: t(`aff_${option.key}`), result: calculate(option.key) })),
    ...[1, 2].map(wait => ({ id: `wait-${wait}`, icon: CalendarClock, label: t("aff_wait", { count: wait }), result: calculate(method, wait) }))]
    .filter(option => option.result.points.length > 0 && option.result.status !== "outside");
  const outcomeColor = result.status === "shortfall" ? "#ef4444" : result.status === "tight" ? "#eab308" : "#14b8a6";

  return <>
    <div className="space-y-5">
      <Card className="rounded-2xl border-sky-500/25 bg-gradient-to-br from-card to-sky-500/10"><CardHeader><CardTitle className="text-lg">{t("aff_purchase")}</CardTitle></CardHeader><CardContent className="space-y-5">
        <Field id="aff-name" label={t("aff_name")}><Input id="aff-name" value={name} onChange={event => setName(event.target.value)} placeholder={t("aff_name_hint")} maxLength={120} /></Field>
        <div className="grid gap-4 sm:grid-cols-2"><MoneyField id="aff-price" label={t("aff_price")} currency={currency} value={price} onChange={setPrice} />
          <Field id="aff-date" label={t("aff_date")}><DatePicker id="aff-date" label={t("aff_date")} min={today} max="2190-12-31" value={date} onChange={setDate} /></Field></div>
        <div className="grid grid-cols-3 gap-2" role="group" aria-label={t("aff_option")}>{methods.map(option => <Button key={option.key} variant={method === option.key ? "default" : "outline"}
          className="h-auto min-h-10 whitespace-normal px-2" aria-pressed={method === option.key} onClick={() => setMethod(option.key)}><option.icon className="mr-1.5 h-4 w-4 shrink-0" />{t(`aff_${option.key}`)}</Button>)}</div>
        {method === "card" && <div className="space-y-4 rounded-xl bg-muted/40 p-4">
          <Field id="aff-card" label={t("aff_card_pick")}><ThemedSelect id="aff-card" value={cardId} onChange={event => { setCardId(event.target.value); setCardDue(null); setCardLimit(null); }}>
            <option value="">{t("aff_card_none")}</option>{cards.map(item => <option key={item.id} value={item.id}>{creditCardLabel(item)}</option>)}</ThemedSelect></Field>
          <div className="grid gap-4 sm:grid-cols-2"><Field id="aff-count" label={t("aff_count")}><Input id="aff-count" type="number" min={1} max={120} step={1} value={installments || ""} onChange={event => setInstallments(Number(event.target.value))} /></Field>
            <MoneyField id="aff-card-fee" label={t("aff_card_fee")} currency={currency} value={cardFee} onChange={setCardFee} />
            <MoneyField id="aff-limit" label={t("aff_limit")} currency={currency} value={cardLimit} onChange={setCardLimit} />
            <Field id="aff-card-due" label={t("aff_due")} hint={t(autoCardDue ? "aff_due_auto" : "aff_due_manual")}><DatePicker id="aff-card-due" label={t("aff_due")} min={validPurchaseDate(date) ? date : today} max="2190-12-31" value={cardDue} onChange={setCardDue} /></Field></div>
        </div>}
        {method === "loan" && <div className="grid gap-4 rounded-xl bg-muted/40 p-4 sm:grid-cols-2">
          <Field id="aff-loan-count" label={t("aff_count")}><Input id="aff-loan-count" type="number" min={1} max={120} step={1} value={loanMonths || ""} onChange={event => setLoanMonths(Number(event.target.value))} /></Field>
          <MoneyField id="aff-loan-payment" label={t("aff_loan_payment")} currency={currency} value={loanPayment} onChange={setLoanPayment} />
          <Field id="aff-loan-due" label={t("aff_due")}><DatePicker id="aff-loan-due" label={t("aff_due")} min={validPurchaseDate(date) ? date : today} max="2190-12-31" value={loanDue} onChange={setLoanDue} /></Field>
        </div>}
      </CardContent></Card>
      <Card className="rounded-2xl border-emerald-500/25 bg-gradient-to-br from-card to-emerald-500/10"><CardHeader><CardTitle className="text-lg">{t("aff_available")}</CardTitle></CardHeader><CardContent className="space-y-5">
        <div className="space-y-2"><p className="text-sm font-medium">{t("aff_assets")}</p><p className="text-xs text-muted-foreground">{t("aff_assets_hint")}</p></div>
        <div className="max-h-52 space-y-2 overflow-y-auto">{holdings.length ? holdings.map(item => {
          const value = savingsValue(item, rates, currency);
          return <label key={item.id} className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm"><input type="checkbox" className="h-4 w-4 accent-primary" checked={selected.includes(item.id)} onChange={event => {
            setSelectedAssets(event.target.checked ? [...selected, item.id] : selected.filter(id => id !== item.id));
          }} /><span className="min-w-0 flex-1 break-words">{item.name} <span className="text-muted-foreground">· {item.asset}</span></span><span className="shrink-0 font-mono">{value === null ? t("aff_none") : money(value)}</span></label>;
        }) : <p className="text-sm text-muted-foreground">{t("aff_no_assets")}</p>}</div>
        <p className="text-sm font-medium">{selectedTotal === null ? t("aff_rates_missing") : t("aff_selected_total", { amount: money(selectedTotal) })}</p>
      </CardContent></Card>
    </div>

    <Card className="rounded-2xl border-amber-500/25 bg-gradient-to-br from-card to-amber-500/10"><CardHeader><CardTitle className="text-lg">{t("aff_plan_title")}</CardTitle><p className="text-sm text-muted-foreground">{t("aff_repayment_window", { start: monthLabel(startMonth), end: monthLabel(ledgerExpenseMonths[5]?.month || "") })}</p></CardHeader><CardContent className="space-y-5">
        <div className="rounded-xl bg-muted/50 p-4"><p className="text-sm text-muted-foreground">{t("aff_ledger_total")}</p>
          <p className="mt-2 text-2xl font-bold">{totalLedgerExpenses === null ? t("aff_none") : money(totalLedgerExpenses)}</p></div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">{ledgerExpenseMonths.map(item => <article key={item.month} className="min-w-0 rounded-xl border bg-card p-4">
        <h3 className="text-sm font-medium capitalize">{fullMonthLabel(item.month)}</h3>
        <p className="mt-3 break-words font-mono text-xl font-bold [overflow-wrap:anywhere]">{item.total === null ? t("aff_none") : money(item.total)}</p>
        <p className="mt-2 text-xs text-muted-foreground">{!item.records ? t("aff_ledger_no_records")
          : item.month > today.slice(0, 7) ? t("aff_future_expense")
          : item.paid !== null && item.paid > 0 ? t("aff_ledger_paid_remaining", { paid: money(item.paid), remaining: item.pending === null ? t("aff_none") : money(item.pending) }) : t("aff_ledger_all_pending")}</p>
      </article>)}</div>
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-primary/5 p-4">
        <p id="aff-plan-message" className="min-w-0 flex-1 text-sm" role="status">{budgetPrompt}</p>
        <Button size="lg" className="h-auto min-h-11 whitespace-normal rounded-xl disabled:bg-muted disabled:text-muted-foreground" disabled={!canCalculate} aria-describedby="aff-plan-message" onClick={() => {
          setConfirmation(snapshot);
          requestAnimationFrame(() => resultRef.current?.scrollIntoView({ block: "start", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }));
        }}>{t("aff_calculate")}</Button>
      </div>
    </CardContent></Card>

    {confirmed && result.points.length > 0 && <section ref={resultRef} className="scroll-mt-4 space-y-5" aria-label={t("aff_result")}>
    <Card className="overflow-hidden rounded-2xl"><CardHeader className="bg-muted/30"><div className="flex items-start gap-3"><TrendingUp className={cn("mt-0.5 h-6 w-6 shrink-0", statusColor(result.status))} /><div><CardTitle className={cn("text-xl", statusColor(result.status))} role="status">{t(statusKey(result.status))}</CardTitle><p className="mt-1 text-sm text-muted-foreground">{name || t("aff_now")}{price !== null && ` · ${money(price)}`} · {t(`aff_${method}`)}</p></div></div>
      <p className="text-sm font-medium">{t(result.minimum! < 0 ? "aff_result_gap" : "aff_result_cash", { month: monthLabel(result.lowestMonth), amount: money(Math.abs(result.minimum!)) })}</p>
      <p className="text-xs text-muted-foreground">{t("aff_result_hint")}</p></CardHeader>
      <CardContent className="space-y-5 pt-6">{result.points.length ? <>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{[
          [t("aff_minimum"), money(result.minimum!)], [t("aff_worst"), monthLabel(result.lowestMonth)],
          [t("aff_remaining"), money(result.remainingDebt)], [t("aff_cost"), money(result.totalCost)],
        ].map(([label, value]) => <div key={label} className="min-w-0 rounded-xl bg-muted/40 p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-2 break-words text-lg font-bold">{value}</p></div>)}</div>
        <div className="h-[280px] w-full" role="img" aria-label={t("aff_chart")}>
          <Suspense fallback={<PageLoading />}><AffordabilityChart points={result.points} currency={currency} color={outcomeColor} /></Suspense>
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground"><span>● {t("aff_before")}</span><span style={{ color: outcomeColor }}>● {t("aff_after")}</span><span>{t("aff_first")}: {dateLabel(result.firstPayment)}</span></div>
        <details className="rounded-xl border p-4"><summary className="cursor-pointer text-sm font-medium">{t("aff_balance_details")}</summary>
          <p className="mt-3 max-w-3xl text-xs leading-relaxed text-muted-foreground">{t("aff_accumulated_hint")}</p>
          <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead><tr className="border-b text-xs text-muted-foreground">{["aff_month", "aff_income", "aff_forecast_expense", "aff_before", "aff_after", "aff_payment"].map(key => <th key={key} className="p-2 font-medium">{t(key)}{(key === "aff_before" || key === "aff_after") && <span className="mt-1 block text-[10px] font-normal">{t("aff_accumulated_balance")}</span>}</th>)}</tr></thead>
            <tbody>{result.points.map(point => {
              const flow = cashFlowsByMonth.get(point.month);
              return <tr key={point.month} className="border-b last:border-0"><th className="p-2 font-medium">{monthLabel(point.month)}</th>
                <td className="p-2 font-mono">{flow?.income == null ? t("aff_none") : money(flow.income)}</td>
                <td className="p-2 font-mono">{flow?.expense == null ? t("aff_none") : money(flow.expense)}</td>
                <td className="p-2 font-mono text-muted-foreground">{money(point.before)}</td>
                <td className={cn("p-2 font-mono font-semibold", point.after < 0 ? "text-destructive" : "text-emerald-700 dark:text-emerald-400")}>{money(point.after)}</td>
                <td className="p-2 font-mono font-semibold text-sky-700 dark:text-sky-400">{money(point.payment)}</td></tr>;
            })}</tbody></table></div>
        </details>
      </> : <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">{t("aff_complete")}</p>}</CardContent>
    </Card>

    <AffordabilityComparisons options={comparisons} selected={method} currency={currency} />
    </section>}
    <details className="rounded-xl border p-4 text-sm"><summary className="cursor-pointer font-medium">{t("aff_assumptions")}</summary><div className="mt-3 space-y-2 text-muted-foreground">{["aff_assumption_cash", "aff_assumption_time", "aff_assumption_price", "aff_assumption_readonly"].map(key => <p key={key}>{t(key)}</p>)}
      {usesExchangeRates && rates && <><p>{t("aff_rates", { source: rates.source, date: ratesDate })}</p>
        {rates.stale && <p>{t("aff_rates_stale", { date: ratesDate })}</p>}</>}</div></details>
  </>;
}
