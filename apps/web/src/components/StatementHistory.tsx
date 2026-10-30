import { useCallback, useId, useMemo } from "react";
import { useTranslation } from "react-i18next";

import { BackfillPaymentsEditor } from "@/components/subscriptions/BackfillPaymentsEditor";
import { type BackfillSelection } from "@/lib/backfillPayments";
import { type ReviewTransaction } from "@/lib/statements";
import type { Currency, Cycle, Subscription } from "@/types";

export interface StatementHistoryGroup {
  key: string;
  rows: ReviewTransaction[];
  combineDates: string[];
  cycle: string;
}

export function StatementHistory({
  group,
  selected,
  subscription,
  currency,
  cycles,
  disabled,
  onChange,
}: {
  group: StatementHistoryGroup;
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
