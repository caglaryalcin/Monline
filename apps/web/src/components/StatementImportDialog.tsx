import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2 } from "lucide-react";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { historicalDateRange } from "@/components/calendar/HistoricalPaymentDialog";
import { SubscriptionLogo } from "@/components/SubscriptionLogo";
import { BackfillPaymentsEditor } from "@/components/subscriptions/BackfillPaymentsEditor";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ThemedSelect } from "@/components/ui/themed-select";
import { api } from "@/lib/api";
import type { BackfillSelection } from "@/lib/backfillPayments";
import { CYCLE_NAME_KEYS } from "@/lib/billingPeriods";
import { categoryLabel } from "@/lib/categoryLabel";
import { queryKeys } from "@/lib/queryKeys";
import { nextStatementPaymentDate } from "@/lib/statementPaymentDate";
import type { ReviewTransaction } from "@/lib/statements";
import { isStatementOnlyTransaction } from "@/lib/statementSubscriptions";
import { statementSubscriptionSuggestions } from "@/lib/statementSubscriptionSuggestions";
import { cn } from "@/lib/utils";
import { categoriesService } from "@/services/categories";
import { currenciesService } from "@/services/currencies";
import { cyclesService } from "@/services/cycles";
import { paymentMethodsService } from "@/services/paymentMethods";
import { subscriptionsService } from "@/services/subscriptions";
import type { Category, Currency, Cycle, PaymentMethod, Subscription } from "@/types";

export interface StatementImportResult {
  subscriptions_created: number;
  payments_imported: number;
  payments_skipped: number;
}
interface ImportConflict {
  transaction_id: string;
  date: string;
  subscription_name: string;
}
function readConflicts(error: unknown): ImportConflict[] {
  if (!error || typeof error !== "object" || !("response" in error)) return [];
  const response = error.response;
  if (!response || typeof response !== "object" || !("conflicts" in response)) return [];
  return Array.isArray(response.conflicts)
    ? response.conflicts.filter(
        (item): item is ImportConflict =>
          !!item &&
          typeof item.transaction_id === "string" &&
          typeof item.date === "string" &&
          typeof item.subscription_name === "string",
      )
    : [];
}
interface Props {
  statementId: string;
  userId: string;
  rows: ReviewTransaction[];
  onClose: () => void;
  onImported: (result: StatementImportResult) => void;
}
const selectClass =
  "h-10 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground";
const normalize = (value: string) =>
  value
    .normalize("NFKD")
    .replace(/ı/g, "i")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
interface Group {
  key: string;
  name: string;
  currency: string;
  rows: ReviewTransaction[];
  target: string;
  cycle: string;
  combineDates: string[];
  active: boolean;
  category: string;
  payment_method: string;
}

function StatementHistory({
  group,
  selected,
  subscription,
  currency,
  cycles,
  disabled,
  onChange,
}: {
  group: Group;
  selected: Set<string>;
  subscription?: Subscription;
  currency?: Currency;
  cycles: Cycle[];
  disabled: boolean;
  onChange: (key: string, selection: BackfillSelection) => void;
}) {
  const { t } = useTranslation();
  const id = useId();
  const sourceRows = useMemo(
    () => group.rows.filter((row) => selected.has(row.id)),
    [group.rows, selected],
  );
  const excludeDates = useMemo(() => sourceRows.map((row) => row.date), [sourceRows]);
  const latest = sourceRows.at(-1);
  const amount =
    latest && group.combineDates.includes(latest.date)
      ? sourceRows
          .filter((row) => row.date === latest.date)
          .reduce((sum, row) => sum + row.amount, 0)
      : (latest?.amount ?? null);
  const cycleId = subscription?.cycle ?? group.cycle;
  const cycle = subscription?.expand?.cycle ?? cycles.find((item) => item.id === cycleId);
  const handleChange = useCallback(
    (selection: BackfillSelection) => onChange(group.key, selection),
    [group.key, onChange],
  );
  return (
    <BackfillPaymentsEditor
      idPrefix={id}
      start={sourceRows[0]?.date ?? ""}
      cycle={cycle?.name ?? "Monthly"}
      frequency={subscription?.frequency ?? 1}
      price={amount}
      currency={currency}
      end={[subscription?.end_date, subscription?.cancellation_date].filter(Boolean).sort()[0]}
      limit={subscription?.payment_limit}
      fixedStart
      excludeDates={excludeDates}
      disabled={disabled}
      title={t("statement_import_history")}
      description={t("statement_import_history_note")}
      onChange={handleChange}
    />
  );
}

export function StatementImportDialog(props: Props) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const importRows = props.rows.filter((row) => !isStatementOnlyTransaction(row));
  const subscriptions = useQuery({
    queryKey: queryKeys.subscriptions.all(props.userId),
    queryFn: () => subscriptionsService.list(props.userId),
    enabled: importRows.length > 0,
  });
  const currencies = useQuery({
    queryKey: queryKeys.currencies.all(props.userId),
    queryFn: () => currenciesService.list(props.userId),
    enabled: importRows.length > 0,
  });
  const cycles = useQuery({
    queryKey: queryKeys.cycles(),
    queryFn: cyclesService.list,
    enabled: importRows.length > 0,
  });
  const categories = useQuery({
    queryKey: queryKeys.categories.all(props.userId),
    queryFn: () => categoriesService.list(props.userId),
    enabled: importRows.length > 0,
  });
  const paymentMethods = useQuery({
    queryKey: queryKeys.paymentMethods.all(props.userId),
    queryFn: () => paymentMethodsService.listForForm(props.userId),
    enabled: importRows.length > 0,
  });
  const failed =
    subscriptions.isError ||
    currencies.isError ||
    cycles.isError ||
    categories.isError ||
    paymentMethods.isError;
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) props.onClose();
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-3xl sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t("statement_import_title")}</DialogTitle>
          <DialogDescription>{t("statement_import_description")}</DialogDescription>
        </DialogHeader>
        {props.rows.length > importRows.length && (
          <p className="rounded-xl border bg-muted/30 p-3 text-sm text-muted-foreground">
            {t("statement_import_one_off")}
          </p>
        )}
        {!importRows.length ? null : failed ? (
          <div className="space-y-3">
            <p role="alert" className="text-sm text-destructive">
              {t("statement_import_load_failed")}
            </p>
            <Button
              variant="outline"
              onClick={() => {
                void subscriptions.refetch();
                void currencies.refetch();
                void cycles.refetch();
                void categories.refetch();
                void paymentMethods.refetch();
              }}
            >
              {t("statement_import_retry")}
            </Button>
          </div>
        ) : subscriptions.data &&
          currencies.data &&
          cycles.data &&
          categories.data &&
          paymentMethods.data ? (
          <ImportForm
            {...props}
            rows={importRows}
            subscriptions={subscriptions.data}
            currencies={currencies.data}
            cycles={cycles.data}
            categories={categories.data}
            paymentMethods={paymentMethods.data}
            busy={busy}
            setBusy={setBusy}
          />
        ) : (
          <Loader2 aria-label={t("loading")} className="h-5 w-5 animate-spin" />
        )}
      </DialogContent>
    </Dialog>
  );
}

function ImportForm({
  statementId,
  userId,
  rows,
  onClose,
  onImported,
  subscriptions,
  currencies,
  cycles,
  categories,
  paymentMethods,
  busy,
  setBusy,
}: Props & {
  subscriptions: Subscription[];
  currencies: Currency[];
  cycles: Cycle[];
  categories: Category[];
  paymentMethods: PaymentMethod[];
  busy: boolean;
  setBusy: (value: boolean) => void;
}) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const range = historicalDateRange();
  const eligible = (row: ReviewTransaction) => row.date >= range.min && row.date <= range.max;
  const cycleOptions = cycles.filter((cycle) => cycle.name !== "One-Time");
  const [selected, setSelected] = useState(
    () =>
      new Set(
        rows
          .filter((row) => row.kind === "charge" && !!row.subscription_service && eligible(row))
          .map((row) => row.id),
      ),
  );
  const [groups, setGroups] = useState<Group[]>(() => {
    const map = new Map<string, ReviewTransaction[]>();
    for (const row of rows.filter((row) => row.kind === "charge")) {
      const key = `${normalize(row.subscription_service || row.merchant)}:${row.currency}`;
      map.set(key, [...(map.get(key) || []), row]);
    }
    return [...map].map(([key, items]) => {
      items.sort((a, b) => a.date.localeCompare(b.date));
      const name = (items[0].subscription_service || items[0].merchant).slice(0, 120);
      const currency = currencies.find((c) => c.code === items[0].currency);
      const matches = statementSubscriptionSuggestions(name, subscriptions, currency?.id).filter(
        (s) => normalize(s.name) === normalize(name),
      );
      const cycle = cycles.find((c) => c.name === "Monthly") || cycleOptions[0];
      const existing = matches.length === 1 ? matches[0] : undefined;
      return {
        key,
        name,
        currency: items[0].currency,
        rows: items,
        target: matches.length === 1 ? matches[0].id : "new",
        cycle: cycle?.id || "",
        combineDates: [],
        active: false,
        category: existing?.category ?? "",
        payment_method: existing
          ? (existing.payment_method ?? "")
          : (paymentMethods.find((method) => method.is_main)?.id ?? ""),
      };
    });
  });
  const [error, setError] = useState("");
  const [history, setHistory] = useState<Record<string, BackfillSelection>>({});
  const onHistoryChange = useCallback((key: string, selection: BackfillSelection) => {
    setHistory((current) =>
      JSON.stringify(current[key]) === JSON.stringify(selection)
        ? current
        : { ...current, [key]: selection },
    );
  }, []);
  const [conflicts, setConflicts] = useState<ImportConflict[]>([]);
  const formRef = useRef<HTMLDivElement>(null);
  const groupRefs = useRef(new Map<string, HTMLElement>());
  const importHintId = useId();
  useEffect(() => {
    if (conflicts.length)
      formRef.current
        ?.querySelector<HTMLElement>('[data-payment-conflict="true"]')
        ?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [conflicts]);
  const update = (key: string, patch: Partial<Group>) => {
    if (
      patch.target !== undefined ||
      patch.name !== undefined ||
      patch.combineDates !== undefined
    ) {
      const ids = new Set(groups.find((group) => group.key === key)?.rows.map((row) => row.id));
      setConflicts((current) => current.filter((conflict) => !ids.has(conflict.transaction_id)));
    }
    setGroups((current) =>
      current.map((group) => (group.key === key ? { ...group, ...patch } : group)),
    );
    setError("");
  };
  const historyNeedsReview = groups.filter(
    (group) =>
      group.rows.some((row) => selected.has(row.id)) &&
      history[group.key]?.enabled &&
      !history[group.key].valid,
  );
  const categoryNeedsReview = groups.filter(
    (group) =>
      group.rows.some((row) => selected.has(row.id)) &&
      !categories.some((category) => category.id === group.category),
  );
  const canImport =
    selected.size > 0 &&
    groups.every((group) => {
      if (!group.rows.some((row) => selected.has(row.id))) return true;
      const currency = currencies.find((c) => c.code === group.currency);
      if (!currency) return false;
      if (!categories.some((category) => category.id === group.category)) return false;
      if (
        group.payment_method &&
        !paymentMethods.some((method) => method.id === group.payment_method)
      )
        return false;
      if (history[group.key]?.enabled && !history[group.key].valid) return false;
      if (group.target !== "new")
        return statementSubscriptionSuggestions(
          group.rows[0].subscription_service || group.rows[0].merchant,
          subscriptions,
          currency.id,
        ).some((s) => s.id === group.target);
      return !!group.name.trim() && !!group.cycle;
    });
  async function transfer() {
    if (!canImport || busy) return;
    setBusy(true);
    setError("");
    setConflicts([]);
    try {
      const result = await api.post<StatementImportResult>(
        `/api/statements/${statementId}/import`,
        {
          utc_offset_minutes: new Date().getTimezoneOffset(),
          paid_offsets: Object.fromEntries(
            rows
              .filter((row) => selected.has(row.id))
              .map((row) => [row.id, new Date(`${row.date}T00:00:00`).getTimezoneOffset()]),
          ),
          groups: groups
            .filter((group) => group.rows.some((row) => selected.has(row.id)))
            .map((group) => ({
              transaction_ids: group.rows
                .filter((row) => selected.has(row.id))
                .map((row) => row.id),
              category: group.category,
              payment_method: group.payment_method,
              combine_dates: group.combineDates.filter((date) =>
                group.rows.some((row) => row.date === date && selected.has(row.id)),
              ),
              ...(history[group.key]?.input
                ? { historical_payments: history[group.key].input }
                : {}),
              ...(group.target === "new"
                ? {
                    new_subscription: {
                      name: group.name,
                      cycle: group.cycle,
                      frequency: 1,
                      active: group.active,
                    },
                  }
                : { subscription_id: group.target }),
            })),
        },
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.subscriptions.all(userId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.paymentRecords.all(userId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all(userId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.yearlyCosts.all(userId) }),
      ]);
      onImported(result);
      onClose();
    } catch (err) {
      const code = err instanceof Error ? err.message : "";
      if (code === "statement_import_conflict") {
        setConflicts(
          readConflicts(err).filter((conflict) => selected.has(conflict.transaction_id)),
        );
      }
      const known = [
        "statement_import_category_required",
        "statement_import_invalid",
        "statement_import_currency",
        "statement_import_ambiguous",
        "statement_import_next_date",
        "statement_import_conflict",
        "historical_invalid_date",
        "historical_invalid_amount",
        "backfill_invalid_selection",
        "backfill_invalid_schedule",
        "backfill_too_many",
      ];
      setError(t(known.includes(code) ? code : "statement_import_failed"));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div ref={formRef} className="space-y-4">
      <p className="rounded-xl border bg-muted/20 p-3 text-sm text-muted-foreground">
        {t("statement_import_schedule_note")}
      </p>
      {groups.map((group) => {
        const currency = currencies.find((c) => c.code === group.currency);
        const nextDate = nextStatementPaymentDate(
          group.rows.filter((row) => selected.has(row.id)).at(-1)?.date || "",
        );
        const groupSelected = group.rows.some((row) => selected.has(row.id));
        const categoryMissing =
          groupSelected && !categories.some((category) => category.id === group.category);
        const categoryErrorId = `${importHintId}-category-${encodeURIComponent(group.key)}`;
        const selectedSubscription = subscriptions.find((sub) => sub.id === group.target);
        const groupLogo = selectedSubscription ?? { name: group.name, url: "" };
        const selectedByDate = new Map<string, ReviewTransaction[]>();
        for (const row of group.rows) {
          if (!selected.has(row.id)) continue;
          const day = selectedByDate.get(row.date) || [];
          day.push(row);
          selectedByDate.set(row.date, day);
        }
        const combinableDays = [...selectedByDate].filter(([, items]) => items.length > 1);
        const formatAmount = (amount: number) =>
          new Intl.NumberFormat(i18n.language.replace("_", "-"), {
            style: "currency",
            currency: group.currency,
          }).format(amount);
        return (
          <section
            key={group.key}
            ref={(node) => {
              if (node) groupRefs.current.set(group.key, node);
              else groupRefs.current.delete(group.key);
            }}
            className="space-y-3 rounded-2xl border p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="flex min-w-0 items-center gap-2 font-semibold">
                <span
                  aria-hidden="true"
                  className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-background"
                >
                  <SubscriptionLogo sub={groupLogo} className="h-full w-full object-contain p-1" />
                </span>
                {group.rows[0].subscription_service || group.rows[0].merchant}
              </h3>
              {group.rows.length > 1 && (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  onClick={() => {
                    setGroups((current) =>
                      current.flatMap((item) =>
                        item.key === group.key
                          ? item.rows.map((row) => ({
                              ...item,
                              key: `${item.key}:${row.id}`,
                              rows: [row],
                              combineDates: [],
                            }))
                          : [item],
                      ),
                    );
                    setError("");
                  }}
                >
                  {t("statement_import_split")}
                </Button>
              )}
              <span className="text-xs text-muted-foreground">{group.currency}</span>
            </div>
            <div className="space-y-2">
              {group.rows.map((row) => {
                const conflict = conflicts.find((item) => item.transaction_id === row.id);
                const conflictHintId = `statement-conflict-${row.id}`;
                return (
                  <label
                    key={row.id}
                    data-payment-conflict={!!conflict}
                    className={cn(
                      "flex items-start gap-3 rounded-xl border border-transparent p-2 text-sm",
                      conflict &&
                        "border-red-500/60 bg-red-50 dark:border-red-400/60 dark:bg-red-950/30",
                    )}
                  >
                    <span className="relative mt-1 h-4 w-4 shrink-0">
                      <input
                        type="checkbox"
                        className="peer block h-4 w-4 appearance-none rounded border border-muted-foreground bg-background checked:border-primary checked:bg-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50"
                        checked={selected.has(row.id)}
                        disabled={busy || !eligible(row)}
                        aria-describedby={conflict ? conflictHintId : undefined}
                        onChange={(event) => {
                          setSelected((current) => {
                            const next = new Set(current);
                            if (event.target.checked) next.add(row.id);
                            else next.delete(row.id);
                            return next;
                          });
                          setConflicts((current) =>
                            current.filter((item) => item.transaction_id !== row.id),
                          );
                          setError("");
                        }}
                      />
                      <Check
                        aria-hidden="true"
                        strokeWidth={3}
                        className="pointer-events-none absolute inset-0 h-4 w-4 text-primary-foreground opacity-0 peer-checked:opacity-100 peer-disabled:text-primary-foreground/50"
                      />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block">
                        <span
                          className={cn(
                            conflict &&
                              "rounded bg-red-100 px-1 font-semibold text-red-800 dark:bg-red-500/20 dark:text-red-200",
                          )}
                        >
                          {row.date}
                        </span>{" "}
                        · {row.merchant}
                      </span>
                      {conflict && (
                        <span
                          id={conflictHintId}
                          className="mt-1 block text-xs font-medium text-red-700 dark:text-red-300"
                        >
                          {t("statement_import_conflict_row", {
                            subscription: conflict.subscription_name,
                            date: conflict.date,
                          })}
                        </span>
                      )}
                      {!eligible(row) && (
                        <span className="text-xs text-muted-foreground">
                          {t("statement_import_date_range")}
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 tabular-nums">
                      {new Intl.NumberFormat(i18n.language.replace("_", "-"), {
                        style: "currency",
                        currency: row.currency,
                      }).format(row.amount)}
                    </span>
                  </label>
                );
              })}
            </div>
            {combinableDays.map(([date, items]) => {
              const combined = group.combineDates.includes(date);
              const total = items.reduce((sum, row) => sum + Math.round(row.amount * 100), 0) / 100;
              return (
                <div
                  key={date}
                  className={cn(
                    "flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-muted/20 p-3",
                    combined && "border-primary/40 bg-primary/10",
                  )}
                >
                  <div className="min-w-0 space-y-1 text-sm">
                    <p className="font-medium">
                      {date} · {items.map((row) => formatAmount(row.amount)).join(" + ")} ={" "}
                      {formatAmount(total)}
                    </p>
                    <p aria-live="polite" className="text-xs text-muted-foreground">
                      {t(
                        combined
                          ? "statement_import_combine_enabled"
                          : "statement_import_combine_hint",
                        {
                          count: items.length,
                          total: formatAmount(total),
                        },
                      )}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant={combined ? "secondary" : "outline"}
                    size="sm"
                    disabled={busy}
                    aria-pressed={combined}
                    onClick={() =>
                      update(group.key, {
                        combineDates: combined
                          ? group.combineDates.filter((day) => day !== date)
                          : [...group.combineDates, date],
                      })
                    }
                  >
                    {t(combined ? "statement_import_uncombine" : "statement_import_combine")}
                  </Button>
                </div>
              );
            })}
            {groupSelected && (
              <fieldset disabled={busy} className="space-y-3 border-t pt-3">
                {!currency && (
                  <p role="alert" className="text-sm text-destructive">
                    {t("statement_import_currency")}
                  </p>
                )}
                {group.target === "new" ? (
                  <>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="grid content-start gap-1 text-sm">
                        <span>{t("statement_subscription")}</span>
                        <div className="relative">
                          <span
                            aria-hidden="true"
                            className="pointer-events-none absolute left-1 top-1 flex h-8 w-8 items-center justify-center overflow-hidden rounded-lg border bg-background"
                          >
                            <SubscriptionLogo
                              sub={{ name: group.name, url: "" }}
                              className="h-full w-full object-contain p-1"
                            />
                          </span>
                          <Input
                            className="pl-12"
                            value={group.name}
                            maxLength={120}
                            onChange={(event) => update(group.key, { name: event.target.value })}
                          />
                        </div>
                      </label>
                      <label className="grid content-start gap-1 text-sm">
                        <span>{t("statement_import_cycle")}</span>
                        <ThemedSelect
                          className={selectClass}
                          value={group.cycle}
                          onChange={(event) => update(group.key, { cycle: event.target.value })}
                        >
                          {cycleOptions.map((c) => (
                            <option key={c.id} value={c.id}>
                              {t(CYCLE_NAME_KEYS[c.name] || c.name)}
                            </option>
                          ))}
                        </ThemedSelect>
                      </label>
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">
                      {selectedSubscription?.name}.{" "}
                    </span>
                    {t("statement_import_existing_note")}
                  </p>
                )}
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="grid content-start gap-1 text-sm">
                    <span>{t("category")} *</span>
                    <ThemedSelect
                      aria-label={t("category")}
                      required
                      aria-invalid={categoryMissing}
                      aria-describedby={categoryMissing ? categoryErrorId : undefined}
                      className={cn(selectClass, categoryMissing && "border-destructive")}
                      value={group.category}
                      onChange={(event) => update(group.key, { category: event.target.value })}
                    >
                      <option value="" hidden disabled />
                      {categories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {categoryLabel(category, t)}
                        </option>
                      ))}
                    </ThemedSelect>
                    {categoryMissing && (
                      <span id={categoryErrorId} className="text-xs text-destructive">
                        {t("category_required")}
                      </span>
                    )}
                  </label>
                  <label className="grid content-start gap-1 text-sm">
                    <span>{t("payment_method")}</span>
                    <ThemedSelect
                      aria-label={t("payment_method")}
                      className={selectClass}
                      value={group.payment_method}
                      onChange={(event) =>
                        update(group.key, { payment_method: event.target.value })
                      }
                    >
                      <option value="" hidden />
                      {paymentMethods.map((method) => (
                        <option key={method.id} value={method.id}>
                          {method.name}
                        </option>
                      ))}
                    </ThemedSelect>
                  </label>
                </div>
                <StatementHistory
                  group={group}
                  selected={selected}
                  subscription={selectedSubscription}
                  currency={currency}
                  cycles={cycles}
                  disabled={busy}
                  onChange={onHistoryChange}
                />
                {group.target === "new" && (
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-primary"
                      checked={group.active}
                      onChange={(event) => update(group.key, { active: event.target.checked })}
                    />
                    {t("statement_import_active")}
                  </label>
                )}
                {(group.target !== "new" || group.active) && (
                  <>
                    <label className="grid max-w-xs gap-1 text-sm">
                      <span>{t("statement_import_next")}</span>
                      <output className="flex h-10 items-center rounded-xl border bg-muted/20 px-3">
                        {nextDate && (
                          <time dateTime={nextDate}>
                            {new Intl.DateTimeFormat(i18n.language.replace("_", "-"), {
                              day: "numeric",
                              month: "long",
                              year: "numeric",
                            }).format(new Date(`${nextDate}T12:00:00`))}
                          </time>
                        )}
                      </output>
                    </label>
                    <p className="text-xs text-muted-foreground">
                      {t("statement_import_next_month")}
                    </p>
                  </>
                )}
              </fieldset>
            )}
          </section>
        );
      })}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {!canImport && selected.size > 0 && (
        <div id={importHintId} role="status" className="space-y-2 text-sm text-destructive">
          {categoryNeedsReview.map((group) => (
            <p key={group.key}>
              {group.name}: {t("category_required")}
            </p>
          ))}
          {historyNeedsReview.length
            ? historyNeedsReview.map((group) => (
                <button
                  key={group.key}
                  type="button"
                  className="block text-left underline underline-offset-4 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => {
                    const section = groupRefs.current.get(group.key);
                    const target =
                      section?.querySelector<HTMLElement>(
                        "[data-backfill-confirmation]:not(:disabled)",
                      ) ?? section?.querySelector<HTMLElement>('[role="switch"]');
                    target?.scrollIntoView({ block: "center", behavior: "smooth" });
                    target?.focus({ preventScroll: true });
                  }}
                >
                  {group.name}: {t("backfill_confirm_required")}
                </button>
              ))
            : !categoryNeedsReview.length && <p>{t("statement_import_invalid")}</p>}
        </div>
      )}
      <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
        <Button variant="outline" disabled={busy} onClick={onClose}>
          {t("cancel")}
        </Button>
        <Button
          disabled={busy || !canImport}
          className="disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none"
          aria-describedby={!canImport && selected.size > 0 ? importHintId : undefined}
          onClick={() => void transfer()}
        >
          {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {t("statement_import_submit", { count: selected.size })}
        </Button>
      </div>
    </div>
  );
}
