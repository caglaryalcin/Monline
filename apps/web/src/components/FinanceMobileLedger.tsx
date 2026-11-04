import { ChevronLeft, ChevronRight, MoreHorizontal, Plus } from "lucide-react";
import { useEffect, useState } from "react";

import { FinanceQuickAmount } from "@/components/FinanceQuickAmount";
import { FinanceRowTag } from "@/components/FinanceRowTag";
import { Button } from "@/components/ui/button";
import {
  type FinanceData,
  type FinanceEntry,
  type FinanceRow,
  financeRowTag,
  isFinanceCarryoverRow,
  sumEntries,
} from "@/lib/finance";

export function FinanceMobileLedger({
  view,
  onViewChange,
  year,
  month,
  onMonthChange,
  monthLabel,
  rows,
  entries,
  summary,
  openingEntries,
  editableOpening,
  onSaveOpening,
  links,
  checks,
  pending,
  label,
  money,
  onEdit,
  onAdd,
  onMenu,
}: {
  view: "monthly" | "annual";
  onViewChange: (view: "monthly" | "annual") => void;
  year: number;
  month: number;
  onMonthChange: (year: number, month: number) => void;
  monthLabel: string;
  rows: FinanceRow[];
  entries: FinanceEntry[];
  summary: { received: number; paid: number; carryover: number; remaining: number };
  openingEntries: FinanceEntry[];
  editableOpening: boolean;
  onSaveOpening: (amount: number | null) => Promise<boolean>;
  links: FinanceData["finance_statement_links"];
  checks: FinanceData["card_payment_checks"];
  pending: boolean;
  label: (key: string) => string;
  money: (value: number) => string;
  onEdit: (row: FinanceRow, month: number) => void;
  onAdd: (kind: "income" | "expense") => void;
  onMenu: (row: FinanceRow, month: number, position: { x: number; y: number }) => void;
}) {
  const [editingOpening, setEditingOpening] = useState(false);
  useEffect(() => setEditingOpening(false), [year, month, view]);
  const period = `${year}-${String(month).padStart(2, "0")}`;
  const monthEntries = entries.filter((entry) => entry.date.startsWith(period));
  const moveMonth = (step: number) => {
    const next = new Date(Date.UTC(year, month - 1 + step, 1));
    onMonthChange(next.getUTCFullYear(), next.getUTCMonth() + 1);
  };
  return (
    <div className="finance-mobile-ledger">
      <div className="finance-mobile-ledger__views" role="group" aria-label={label("ledger_view")}>
        <Button
          variant="ghost"
          aria-pressed={view === "monthly"}
          disabled={pending}
          onClick={() => onViewChange("monthly")}
        >
          {label("monthly_view")}
        </Button>
        <Button
          variant="ghost"
          aria-pressed={view === "annual"}
          disabled={pending}
          onClick={() => onViewChange("annual")}
        >
          {label("ledger")}
        </Button>
      </div>
      {view === "monthly" && (
        <div className="finance-mobile-ledger__content">
          <div className="finance-mobile-ledger__month">
            <Button
              size="icon"
              variant="ghost"
              aria-label={label("previous_month")}
              disabled={pending || (year === 1970 && month === 1)}
              onClick={() => moveMonth(-1)}
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <h2 aria-live="polite">
              {monthLabel} {year}
            </h2>
            <Button
              size="icon"
              variant="ghost"
              aria-label={label("next_month")}
              disabled={pending || (year === 2200 && month === 12)}
              onClick={() => moveMonth(1)}
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
          <dl className="finance-mobile-ledger__summary">
            {(
              [
                ["sheet_income", summary.received],
                ["expense", summary.paid + summary.carryover],
                ["sheet_cash", summary.remaining],
              ] as const
            ).map(([key, amount]) => (
              <div key={key}>
                <dt>{label(key)}</dt>
                <dd>{money(amount)}</dd>
              </div>
            ))}
          </dl>
          {(["income", "expense"] as const).map((kind) => {
            const group = rows.filter((row) => (row.kind === "expense") === (kind === "expense"));
            return (
              <section
                key={kind}
                className="finance-mobile-ledger__section"
                aria-label={label(kind === "income" ? "sheet_incomes" : "expense")}
              >
                <div className="finance-mobile-ledger__section-header">
                  <h3>{label(kind === "income" ? "sheet_incomes" : "expense")}</h3>
                  <Button size="sm" variant="ghost" disabled={pending} onClick={() => onAdd(kind)}>
                    <Plus className="mr-1 h-4 w-4" />
                    {label(kind === "income" ? "new_income" : "new_expense")}
                  </Button>
                </div>
                {group.length === 0 && (
                  <p className="finance-mobile-ledger__empty">{label("empty_month")}</p>
                )}
                {group.map((row) => {
                  const automatic = isFinanceCarryoverRow(row);
                  const cell = monthEntries.filter((entry) => entry.row_id === row.id);
                  const settled = cell.filter((entry) => entry.status === "settled");
                  const planned = cell.filter((entry) => entry.status === "planned");
                  const tag = financeRowTag(row);
                  const canEditOpening = automatic && editableOpening && month === 1;
                  const link = links?.find(
                    (item) => item.row_id === row.id && item.month === period,
                  );
                  const check = link ? checks?.[link.id] : undefined;
                  return (
                    <div
                      key={row.id}
                      className="finance-mobile-ledger__row"
                      data-finance-mobile-row={row.id}
                    >
                      {automatic && editingOpening ? (
                        <div className="finance-mobile-ledger__opening">
                          <span>{row.name}</span>
                          <FinanceQuickAmount
                            row={row}
                            entries={
                              openingEntries.length
                                ? [{ ...openingEntries[0], amount: sumEntries(openingEntries) }]
                                : []
                            }
                            title={row.name}
                            language=""
                            label={label}
                            pending={pending}
                            onSave={async (amounts) => {
                              const saved = await onSaveOpening(amounts[0]);
                              if (saved) setEditingOpening(false);
                              return saved;
                            }}
                            onCancel={() => setEditingOpening(false)}
                          />
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="finance-mobile-ledger__entry"
                          disabled={pending || (automatic && !canEditOpening)}
                          aria-label={`${row.name} · ${monthLabel} ${year} · ${label(automatic && !canEditOpening ? "automatic" : "edit")}`}
                          onClick={() => (automatic ? setEditingOpening(true) : onEdit(row, month))}
                        >
                          <span className="finance-mobile-ledger__name">
                            <span className="finance-mobile-ledger__name-text">{row.name}</span>
                            {tag && (
                              <FinanceRowTag
                                type={tag}
                                label={label(
                                  tag === "credit_card"
                                    ? "credit_card"
                                    : tag === "salary"
                                      ? "salary"
                                      : tag === "loan"
                                        ? "loan"
                                        : tag === "rent"
                                          ? "rent"
                                          : `bill_${tag}`,
                                )}
                              />
                            )}
                            {automatic && (
                              <span className="finance-mobile-ledger__status">
                                {label("automatic")}
                              </span>
                            )}
                            {link && (
                              <span
                                className="finance-mobile-ledger__status"
                                data-check={check?.status}
                              >
                                {label(
                                  check
                                    ? `card_payment_status_${check.status}`
                                    : "statement_linked",
                                )}
                              </span>
                            )}
                          </span>
                          <span className="finance-mobile-ledger__amounts">
                            {automatic ? (
                              <span className="font-semibold">{money(summary.carryover)}</span>
                            ) : (
                              <>
                                {settled.length > 0 && (
                                  <span
                                    className={
                                      kind === "income"
                                        ? "finance-sheet__received"
                                        : "finance-sheet__settled"
                                    }
                                  >
                                    {money(sumEntries(settled))}
                                    <span className="finance-mobile-ledger__status">
                                      {label(
                                        kind === "income" ? "income_received" : "expense_paid",
                                      )}
                                    </span>
                                  </span>
                                )}
                                {planned.length > 0 && (
                                  <span
                                    className={
                                      kind === "income"
                                        ? "finance-sheet__expected"
                                        : "finance-sheet__pending"
                                    }
                                  >
                                    {money(sumEntries(planned))}
                                    <span className="finance-mobile-ledger__status">
                                      {label(
                                        kind === "income" ? "income_expected" : "expense_pending",
                                      )}
                                    </span>
                                  </span>
                                )}
                                {cell.length === 0 && (
                                  <span className="finance-mobile-ledger__status">
                                    {label("empty_cell")}
                                  </span>
                                )}
                              </>
                            )}
                          </span>
                        </button>
                      )}
                      {!automatic && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="finance-mobile-ledger__menu"
                          disabled={pending}
                          aria-label={`${row.name} · ${label("cell_actions")}`}
                          onClick={(event) => {
                            const bounds = event.currentTarget.getBoundingClientRect();
                            onMenu(row, month, { x: bounds.left, y: bounds.bottom });
                          }}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  );
                })}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
