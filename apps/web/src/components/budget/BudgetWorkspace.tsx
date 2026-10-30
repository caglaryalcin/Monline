import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { StatementLink } from "@/components/StatementLink";
import { ManualBillActions } from "@/components/subscriptions/ManualBillActions";
import { ManualBillDialog } from "@/components/subscriptions/ManualBillDialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { useLocalToday } from "@/hooks/useLocalToday";
import { dialogDismissHandler } from "@/lib/dialogDismiss";
import {
  type ExpenseRowTag,
  type FinanceRow,
  financeRowsForYear,
  financeRowTag,
  financeRowTagValues,
  ROW_TAGS,
} from "@/lib/finance";
import { spendingKey } from "@/lib/spending";
import { toast } from "@/lib/toast";
import { formatCurrency } from "@/lib/utils";
import { type BudgetEvent, budgetService, type BudgetTotal } from "@/services/budget";
import { financeService } from "@/services/finance";

const selectClass = "h-10 max-w-full rounded-md border border-input bg-background px-3 text-sm";
export function BudgetWorkspace({ compact = false }: { compact?: boolean }) {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const { t, i18n } = useTranslation();
  const today = useLocalToday();
  const [month, setMonth] = useState(today.slice(0, 7));
  const [tab, setTab] = useState("expenses");
  const [section, setSection] = useState("all");
  const [bill, setBill] = useState(false);
  const [planRow, setPlanRow] = useState<FinanceRow | null>(null);
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["budget", user?.id, month],
    queryFn: () => budgetService.get(month),
    enabled: !!user?.id,
    staleTime: 0,
  });
  const finance = useQuery({
    queryKey: ["finance", user?.id],
    queryFn: financeService.get,
    enabled: !!user?.id && !compact,
  });
  const refresh = async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: ["budget"] }),
      client.invalidateQueries({ queryKey: ["finance", user?.id] }),
      client.invalidateQueries({ queryKey: spendingKey(userId) }),
    ]);
  };
  const mutation = useMutation({
    mutationFn: (action: () => Promise<unknown>) => action(),
    onSuccess: refresh,
    onError: (error) =>
      toast.error(t(error.message.startsWith("budget_") ? error.message : "budget_save_failed")),
  });
  const money = (value: number, currency = "TRY") =>
    formatCurrency(value, currency, { locale: i18n.language.replace("_", "-") });
  const amounts = (values: BudgetTotal[]) =>
    values.length
      ? values.map((value) => money(value.amount, value.currency)).join(" · ")
      : money(0);
  const data = query.data;
  const year = Number(month.slice(0, 4));
  const rows = financeRowsForYear(finance.data?.finance_rows || [], year, finance.data);
  const cards = rows.filter((row) => row.expense_type === "credit_card");
  const cashTry = data?.cash.find((total) => total.currency === "TRY")?.amount || 0;
  const available = data ? data.opening + data.received - cashTry : 0;
  const [newName, setNewName] = useState("");
  const [newTag, setNewTag] = useState<ExpenseRowTag>("");
  return (
    <section className="space-y-5" aria-label={t("budget_workspace")}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">{t("budget_workspace")}</h2>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{t("budget_intro")}</p>
        </div>
        <div>
          <Label htmlFor={compact ? "budget-month-compact" : "budget-month"}>
            {t("spending_month")}
          </Label>
          <Input
            id={compact ? "budget-month-compact" : "budget-month"}
            type="month"
            min="1970-01"
            max="2200-12"
            value={month}
            onChange={(event) => {
              if (event.target.value) setMonth(event.target.value);
            }}
          />
        </div>
      </div>
      {query.isError && (
        <p role="alert" className="rounded-xl border border-destructive p-4 text-sm">
          {t("budget_load_failed")}{" "}
          <Button variant="outline" onClick={() => void query.refetch()}>
            {t("budget_retry")}
          </Button>
        </p>
      )}
      {query.isLoading && <p role="status">{t("loading")}</p>}
      {data && (
        <>
          {data.review_required && (
            <p
              role="alert"
              className="rounded-xl border border-amber-500 bg-amber-500/10 p-4 text-sm"
            >
              {t("budget_review_required")}
            </p>
          )}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ["budget_pending_cash", amounts(data.cash_planned), "budget_pending_cash_help"],
              ["budget_cash_out", amounts(data.cash), "budget_cash_out_help"],
              [
                "budget_actual_expenses",
                data.review_required ? "—" : amounts(data.expenses),
                "budget_actual_expenses_help",
              ],
              [
                "budget_available",
                data.review_required ? "—" : money(available),
                "budget_available_help",
              ],
            ].map(([label, value, help]) => (
              <article key={label} className="rounded-2xl border bg-card p-4">
                <h3 className="text-sm text-muted-foreground">{t(label)}</h3>
                <p className="mt-2 text-xl font-semibold tabular-nums">{value}</p>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{t(help)}</p>
              </article>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            {t("budget_opening")}: {money(data.opening)} · {t("budget_income")}:{" "}
            {money(data.received)}. {t("budget_currency_help")}
          </p>
          {compact ? (
            <a href="/finance#budget" className="inline-block text-sm text-primary underline">
              {t("budget_open_workspace")}
            </a>
          ) : (
            <>
              <details className="rounded-xl border p-4">
                <summary className="cursor-pointer font-medium">{t("budget_start")}</summary>
                <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
                  {[1, 2, 3, 4].map((step) => (
                    <li key={step}>{t(`budget_step_${step}`)}</li>
                  ))}
                </ol>
                <Button
                  variant="outline"
                  className="mt-3"
                  disabled={mutation.isPending}
                  onClick={() => mutation.mutate(budgetService.template)}
                >
                  {t("budget_create_template")}
                </Button>
              </details>
              <nav className="flex flex-wrap gap-2" aria-label={t("budget_views")}>
                {["expenses", "matching", "debts", "settings"].map((value) => (
                  <Button
                    key={value}
                    variant={tab === value ? "default" : "outline"}
                    onClick={() => setTab(value)}
                  >
                    {t(`budget_tab_${value}`)}
                  </Button>
                ))}
              </nav>
              {tab === "expenses" && (
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    {["all", "online", "bills", "installments", "fixed", "other"].map((value) => (
                      <Button
                        key={value}
                        size="sm"
                        variant={section === value ? "default" : "outline"}
                        onClick={() => setSection(value)}
                      >
                        {t(value === "fixed" ? "finance_fixed" : `spending_section_${value}`)}
                      </Button>
                    ))}
                    <Button size="sm" variant="outline" onClick={() => setBill(true)}>
                      {t("spending_add_bill")}
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground">{t("budget_breakdown_help")}</p>
                  <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                    {data.breakdown.map((group) => (
                      <div key={group.category} className="rounded-xl border p-3">
                        <dt className="text-xs text-muted-foreground">
                          {t(
                            group.category === "fixed"
                              ? "finance_fixed"
                              : `spending_section_${group.category}`,
                          )}
                        </dt>
                        <dd className="mt-1 font-semibold tabular-nums">
                          {data.review_required ? "—" : amounts(group.totals)}
                        </dd>
                      </div>
                    ))}
                  </dl>
                  <div className="overflow-x-auto rounded-xl border">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b bg-muted/30">
                          {[
                            "statement_date",
                            "name",
                            "amount",
                            "spending_bill_status",
                            "budget_proof",
                          ].map((label) => (
                            <th key={label} className="p-3">
                              {t(label)}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {data.events
                          .filter(
                            (event) =>
                              !event.duplicate_of &&
                              event.counts_as_expense &&
                              (section === "all" || event.budget_category === section),
                          )
                          .map((event) => (
                            <tr key={event.id} className="border-b last:border-0">
                              <td className="whitespace-nowrap p-3">
                                {event.date || event.statement_period}
                              </td>
                              <td className="p-3">
                                <p className="font-medium">
                                  {event.verified_target_name || event.name}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {event.verified_target_name && `${event.name} · `}
                                  {event.card_name || t("finance_direct_payment")}
                                  {event.installment && ` · ${event.installment}`}
                                </p>
                              </td>
                              <td className="whitespace-nowrap p-3 tabular-nums">
                                {money(event.amount, event.currency)}
                              </td>
                              <td className="p-3">{t(`spending_status_${event.status}`)}</td>
                              <td className="p-3">
                                <Proof event={event} />
                                {event.manual_bill_id && (
                                  <ManualBillActions
                                    bill={{
                                      ...event,
                                      source: "manual_bill",
                                      kind: "expense",
                                      bill: true,
                                      status: event.status === "settled" ? "settled" : "planned",
                                    }}
                                    onChanged={() => void refresh()}
                                  />
                                )}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                  {!data.events.some(
                    (event) =>
                      event.counts_as_expense &&
                      !event.duplicate_of &&
                      (section === "all" || event.budget_category === section),
                  ) && <p className="text-sm text-muted-foreground">{t("budget_no_records")}</p>}
                  <h3 className="font-semibold">{t("budget_cash_plan")}</h3>
                  <p className="text-sm text-muted-foreground">{t("budget_cash_plan_help")}</p>
                  <div className="divide-y rounded-xl border">
                    {data.events
                      .filter(
                        (event) =>
                          event.status === "planned" &&
                          !event.duplicate_of &&
                          !event.card_row_id &&
                          event.source !== "statement" &&
                          event.kind !== "carryover",
                      )
                      .map((event) => (
                        <div
                          key={event.id}
                          className="flex flex-wrap justify-between gap-2 p-3 text-sm"
                        >
                          <span>
                            {event.date} · {event.name}
                          </span>
                          <span className="tabular-nums">
                            {money(event.amount, event.currency)}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              )}
              {tab === "matching" && (
                <div className="space-y-4">
                  <p className="max-w-3xl text-sm text-muted-foreground">
                    {t("budget_matching_help")}
                  </p>
                  {data.targets.length ? (
                    data.targets.map((target) => (
                      <MatchRow
                        key={target.id}
                        target={target}
                        candidates={data.statements}
                        month={month}
                        busy={mutation.isPending}
                        onAction={(action) => mutation.mutate(action)}
                        money={money}
                      />
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">{t("budget_no_records")}</p>
                  )}
                </div>
              )}
              {tab === "debts" && (
                <div className="space-y-6">
                  <section className="space-y-3">
                    <h3 className="font-semibold">{t("budget_card_debts")}</h3>
                    <p className="text-sm text-muted-foreground">{t("budget_card_debts_help")}</p>
                    <div className="grid gap-3 md:grid-cols-2">
                      {data.cards.map((card) => (
                        <article key={card.row_id} className="space-y-2 rounded-xl border p-4">
                          <h4 className="font-semibold">{card.name}</h4>
                          <p>
                            {t("budget_statement_balance")}:{" "}
                            {card.balance == null ? t("budget_unknown") : money(card.balance)}
                          </p>
                          <p>
                            {t("budget_card_paid")}: {money(card.paid)}
                          </p>
                          <p>
                            {t("budget_card_remaining")}:{" "}
                            {card.remaining == null ? t("budget_unknown") : money(card.remaining)}
                          </p>
                          {card.overpaid > 0 && (
                            <p>
                              {t("budget_card_credit")}: {money(card.overpaid)}
                            </p>
                          )}
                          {card.statement_id ? (
                            <StatementLink
                              statementId={card.statement_id}
                              className="text-sm text-primary underline"
                            >
                              {t("finance_go_statement")}
                            </StatementLink>
                          ) : (
                            <p className="text-xs text-muted-foreground">
                              {t("spending_statement_missing")}
                            </p>
                          )}
                        </article>
                      ))}
                    </div>
                  </section>
                  <section className="space-y-3">
                    <h3 className="font-semibold">{t("budget_finite_plans")}</h3>
                    <p className="text-sm text-muted-foreground">{t("budget_finite_plans_help")}</p>
                    <div className="grid gap-3 md:grid-cols-2">
                      {data.installments.map((plan) => (
                        <article key={plan.row_id} className="space-y-2 rounded-xl border p-4">
                          <h4 className="font-semibold">{plan.name}</h4>
                          <p>
                            {t("budget_paid_count")}: {plan.paid} / {plan.total}
                          </p>
                          <progress
                            className="w-full"
                            max={plan.total || 1}
                            value={plan.paid}
                            aria-label={plan.name}
                          />
                          <p>
                            {t("budget_paid_amount")}: {money(plan.paid_amount)}
                          </p>
                          <p>
                            {t("spending_remaining_count")}: {plan.remaining} ·{" "}
                            {money(plan.remaining_amount)}
                          </p>
                          <p>
                            {t("budget_monthly_plan")}: {money(plan.monthly_amount)}
                          </p>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              setPlanRow(
                                finance.data?.finance_rows.find((row) => row.id === plan.row_id) ||
                                  null,
                              )
                            }
                          >
                            {t("budget_plan_create")}
                          </Button>
                        </article>
                      ))}
                    </div>
                  </section>
                  <section className="space-y-3">
                    <h3 className="font-semibold">{t("spending_installments_source")}</h3>
                    <p className="text-sm text-muted-foreground">
                      {t("budget_card_installments_help")}
                    </p>
                    <div className="grid gap-3 md:grid-cols-2">
                      {data.card_installments.map((plan) => (
                        <article key={plan.id} className="space-y-2 rounded-xl border p-4">
                          <h4 className="font-semibold">
                            {plan.name} · {plan.card_name}
                          </h4>
                          <p>
                            {t("spending_installment_progress")}: {plan.current} / {plan.total}
                          </p>
                          <p>
                            {t("spending_remaining_count")}: {plan.remaining} ·{" "}
                            {money(plan.remaining_amount, plan.currency)}
                          </p>
                          <StatementLink
                            statementId={plan.statement_id}
                            className="text-sm text-primary underline"
                          >
                            {t("finance_go_statement")}
                          </StatementLink>
                        </article>
                      ))}
                    </div>
                  </section>
                </div>
              )}
              {tab === "settings" && (
                <div className="space-y-5">
                  <p className="text-sm text-muted-foreground">{t("budget_settings_help")}</p>
                  <form
                    className="flex flex-wrap items-end gap-2"
                    onSubmit={(event) => {
                      event.preventDefault();
                      if (newName.trim())
                        mutation.mutate(() =>
                          financeService
                            .save(
                              "finance_rows",
                              {
                                name: newName.trim(),
                                kind: "expense",
                                ...financeRowTagValues(newTag),
                                notes: "",
                              },
                              undefined,
                              year,
                            )
                            .then(() => setNewName("")),
                        );
                    }}
                  >
                    <div>
                      <Label htmlFor="budget-row-name">{t("finance_expense_name")}</Label>
                      <Input
                        id="budget-row-name"
                        value={newName}
                        maxLength={160}
                        required
                        onChange={(event) => setNewName(event.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="budget-row-type">{t("finance_bill_type")}</Label>
                      <select
                        id="budget-row-type"
                        className={selectClass}
                        value={newTag}
                        onChange={(event) => setNewTag(event.target.value as ExpenseRowTag)}
                      >
                        {ROW_TAGS.map((value) => (
                          <option key={value} value={value}>
                            {t(
                              `finance_${value === "loan" || value === "credit_card" ? value : value ? `bill_${value}` : "bill_none"}`,
                            )}
                          </option>
                        ))}
                      </select>
                    </div>
                    <Button type="submit" disabled={mutation.isPending}>
                      {t("finance_new_row")}
                    </Button>
                  </form>
                  <div className="space-y-3">
                    {rows
                      .filter((row) => row.kind === "expense")
                      .map((row) => (
                        <article
                          key={row.id}
                          className="flex flex-wrap items-center gap-3 rounded-xl border p-3"
                        >
                          <span className="min-w-36 flex-1 font-medium">{row.name}</span>
                          <select
                            className={selectClass}
                            aria-label={`${row.name} · ${t("finance_bill_type")}`}
                            value={financeRowTag(row)}
                            disabled={mutation.isPending}
                            onChange={(event) => {
                              const tag = event.currentTarget.value as ExpenseRowTag;
                              mutation.mutate(() =>
                                financeService.save(
                                  "finance_rows",
                                  {
                                    ...financeRowTagValues(tag),
                                    payment_card:
                                      tag === "credit_card" ? "" : row.payment_card || "",
                                  },
                                  row.id,
                                  year,
                                ),
                              );
                            }}
                          >
                            {ROW_TAGS.map((value) => (
                              <option key={value} value={value}>
                                {t(
                                  `finance_${value === "loan" || value === "credit_card" ? value : value ? `bill_${value}` : "bill_none"}`,
                                )}
                              </option>
                            ))}
                          </select>
                          {row.expense_type !== "credit_card" && (
                            <select
                              className={selectClass}
                              value={row.payment_card || ""}
                              aria-label={`${row.name} · ${t("finance_payment_card")}`}
                              disabled={mutation.isPending}
                              onChange={(event) => {
                                const paymentCard = event.currentTarget.value;
                                mutation.mutate(() =>
                                  financeService.save(
                                    "finance_rows",
                                    { payment_card: paymentCard },
                                    row.id,
                                    year,
                                  ),
                                );
                              }}
                            >
                              <option value="">{t("finance_direct_payment")}</option>
                              {cards.map((card) => (
                                <option key={card.id} value={card.id}>
                                  {card.name}
                                </option>
                              ))}
                            </select>
                          )}
                          {row.expense_type !== "credit_card" && (
                            <Button variant="outline" size="sm" onClick={() => setPlanRow(row)}>
                              {t("budget_plan_create")}
                            </Button>
                          )}
                        </article>
                      ))}
                  </div>
                  <h3 className="font-semibold">{t("budget_subscription_methods")}</h3>
                  <p className="text-sm text-muted-foreground">
                    {t("budget_subscription_methods_help")}
                  </p>
                  <div className="grid gap-3 md:grid-cols-2">
                    {data.payment_methods.map((method) => (
                      <div
                        key={method.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3"
                      >
                        <Label htmlFor={`budget-method-${method.id}`}>{method.name}</Label>
                        <select
                          id={`budget-method-${method.id}`}
                          className={selectClass}
                          value={method.finance_card}
                          disabled={mutation.isPending}
                          onChange={(event) => {
                            const paymentCard = event.currentTarget.value;
                            mutation.mutate(() =>
                              budgetService.paymentMethod(method.id, paymentCard),
                            );
                          }}
                        >
                          <option value="">{t("finance_direct_payment")}</option>
                          {cards.map((card) => (
                            <option key={card.id} value={card.id}>
                              {card.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}
      {bill && (
        <ManualBillDialog
          month={month}
          onSaved={() => void refresh()}
          onClose={() => {
            setBill(false);
            void refresh();
          }}
        />
      )}
      {planRow && (
        <PlanDialog
          row={planRow}
          month={month}
          onClose={() => setPlanRow(null)}
          onSaved={refresh}
        />
      )}
    </section>
  );
}
function Proof({ event }: { event: BudgetEvent }) {
  const { t } = useTranslation();
  return (
    <div className="space-y-1">
      <p
        className={
          event.verification === "verified"
            ? "text-emerald-700 dark:text-emerald-300"
            : event.verification === "changed"
              ? "text-amber-700 dark:text-amber-300"
              : "text-muted-foreground"
        }
      >
        {t(
          event.verification === "verified"
            ? "budget_verified"
            : event.verification === "changed"
              ? "budget_proof_changed"
              : event.source === "statement"
                ? "budget_source_statement"
                : "budget_unverified",
        )}
      </p>
      {(event.statement_id || event.verified_statement_id) && (
        <StatementLink
          statementId={(event.statement_id || event.verified_statement_id)!}
          className="text-xs text-primary underline"
        >
          {t("finance_go_statement")}
        </StatementLink>
      )}
    </div>
  );
}
function MatchRow({
  target,
  candidates,
  month,
  busy,
  onAction,
  money,
}: {
  target: BudgetEvent;
  candidates: BudgetEvent[];
  month: string;
  busy: boolean;
  onAction: (action: () => Promise<unknown>) => void;
  money: (amount: number, currency: string) => string;
}) {
  const { t } = useTranslation();
  const [chosen, setChosen] = useState("");
  const options = candidates.filter(
    (source) =>
      source.currency === target.currency &&
      Math.round(source.amount * 100) === Math.round(target.amount * 100) &&
      (!target.card_row_id || target.card_row_id === source.card_row_id) &&
      (!source.verified_target_id || source.verified_target_id === target.id),
  );
  const source = options.find((event) => event.id === chosen);
  const [prefix, id] = target.id.split(":");
  const types: Record<string, string> = {
    ledger: "finance_entries",
    bill: "manual_bills",
    subscription: "payment_records",
    manual: "finance_card_transactions",
  };
  return (
    <article className="space-y-3 rounded-xl border p-4">
      <div className="flex flex-wrap justify-between gap-3">
        <div>
          <h3 className="font-medium">
            {target.name} · {money(target.amount, target.currency)}
          </h3>
          <p className="text-xs text-muted-foreground">
            {target.date} · {t(`budget_source_${target.source === "payment" ? "payment" : prefix}`)}{" "}
            · {t(`spending_status_${target.status}`)}
          </p>
        </div>
        <Proof event={target} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <select
          aria-label={`${target.name} · ${t("budget_choose_transaction")}`}
          className={`${selectClass} min-w-0 flex-1`}
          value={chosen}
          disabled={busy}
          onChange={(event) => setChosen(event.target.value)}
        >
          <option value="">
            {t(options.length ? "budget_choose_transaction" : "budget_no_candidate")}
          </option>
          {options.map((event) => (
            <option key={event.id} value={event.id}>
              {event.date} · {event.name} · {money(event.amount, event.currency)} ·{" "}
              {event.card_name || event.statement_period}
            </option>
          ))}
        </select>
        <Button
          disabled={busy || !source}
          onClick={() => {
            if (source?.statement_id)
              onAction(() =>
                budgetService.match({
                  month,
                  target_type: types[prefix],
                  target_id: id,
                  statement_id: source.statement_id!,
                  transaction_id: source.id.slice(`statement:${source.statement_id}:`.length),
                }),
              );
          }}
        >
          {t("budget_verify")}
        </Button>
        <Button
          variant="outline"
          disabled={busy || !source}
          onClick={() => {
            if (source?.statement_id)
              onAction(() =>
                budgetService.match({
                  month,
                  target_type: types[prefix],
                  target_id: id,
                  statement_id: source.statement_id!,
                  transaction_id: source.id.slice(`statement:${source.statement_id}:`.length),
                  relation: "different",
                }),
              );
          }}
        >
          {t("budget_different")}
        </Button>
        {target.match_id && (
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => onAction(() => budgetService.unmatch(target.match_id!))}
          >
            {t("budget_unverify")}
          </Button>
        )}
      </div>
      {target.separations?.map((decision) => (
        <div
          key={decision.id}
          className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"
        >
          <span>
            {t(decision.valid ? "budget_separate_confirmed" : "budget_proof_changed")} ·{" "}
            {decision.name}
          </span>
          <Button
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={() => onAction(() => budgetService.unmatch(decision.id))}
          >
            {t("budget_unverify")}
          </Button>
        </div>
      ))}
    </article>
  );
}
function PlanDialog({
  row,
  month,
  onClose,
  onSaved,
}: {
  row: FinanceRow;
  month: string;
  onClose: () => void;
  onSaved: () => Promise<unknown>;
}) {
  const { t } = useTranslation();
  const [from, setFrom] = useState(month),
    [to, setTo] = useState(month),
    [amount, setAmount] = useState(""),
    [day, setDay] = useState("1");
  const mutation = useMutation({
    mutationFn: () =>
      budgetService.plan({ row_id: row.id, from, to, day: Number(day), amount: Number(amount) }),
    onSuccess: async (result) => {
      await onSaved();
      toast.success(t("finance_plan_done", { count: result.created }));
      onClose();
    },
  });
  return (
    <Dialog
      open
      onOpenChange={dialogDismissHandler(onClose, mutation.isPending)}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {row.name} · {t("budget_plan_create")}
          </DialogTitle>
          <DialogDescription>{t("budget_plan_help")}</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            mutation.mutate();
          }}
        >
          <div className="grid grid-cols-2 gap-3">
            {[
              ["from", from, setFrom],
              ["to", to, setTo],
            ].map(([name, value, setter]) => (
              <div key={String(name)}>
                <Label htmlFor={`budget-plan-${name}`}>{t(`budget_plan_${name}`)}</Label>
                <Input
                  id={`budget-plan-${name}`}
                  type="month"
                  min="1970-01"
                  max="2200-12"
                  value={String(value)}
                  required
                  disabled={mutation.isPending}
                  onChange={(event) => (setter as (value: string) => void)(event.target.value)}
                />
              </div>
            ))}
          </div>
          <Label htmlFor="budget-plan-amount">{t("amount")}</Label>
          <Input
            id="budget-plan-amount"
            type="number"
            min="0.01"
            max="1000000000000"
            step="0.01"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            required
            disabled={mutation.isPending}
          />
          <Label htmlFor="budget-plan-day">{t("finance_day")}</Label>
          <Input
            id="budget-plan-day"
            type="number"
            min="1"
            max="31"
            value={day}
            onChange={(event) => setDay(event.target.value)}
            required
            disabled={mutation.isPending}
          />
          {mutation.isError && (
            <p role="alert" className="text-sm text-destructive">
              {t("budget_invalid_plan")}
            </p>
          )}
          <Button type="submit" disabled={mutation.isPending || from > to}>
            {t("budget_plan_create")}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
