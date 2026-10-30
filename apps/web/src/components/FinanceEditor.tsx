import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { FinanceCardPaymentComparison } from "@/components/FinanceCardPaymentComparison";
import { FinanceRowProvider } from "@/components/FinanceRowProvider";
import { StatementLink } from "@/components/StatementLink";
import { Button } from "@/components/ui/button";
import { DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { INCOME_ROW_TAGS, ROW_TAGS } from "@/lib/finance";
import {
  canTagPayment,
  type ExpenseRowTag,
  type FinanceData,
  type FinanceEntry,
  type FinanceRow,
  financeRowTag,
  financeRowTagValues,
  isCardPaid,
} from "@/lib/finance";
import { cn } from "@/lib/utils";
import { financeService } from "@/services/finance";

export type FinanceEditorState =
  | {
      type: "row";
      row?: FinanceRow;
      focusNotes?: boolean;
      confirmDelete?: boolean;
      position?: {
        rowId: string;
        side: "above" | "below";
        expectedOrder: string[];
        kind: FinanceRow["kind"];
      };
    }
  | { type: "cell"; row: FinanceRow; month: number; entryId?: string }
  | { type: "plan"; row: FinanceRow }
  | { type: "reference"; month: number; year?: number; field?: "usd" | "eur" | "minimum" };

const financeSelectClass = "h-10 w-full rounded-md border border-input bg-background px-3 text-sm";

export function FinanceEditor({
  editor,
  year,
  data,
  today,
  pending,
  run,
  onRowSaved,
  label,
  money,
  monthName,
}: {
  editor: FinanceEditorState;
  year: number;
  data: FinanceData;
  today: string;
  pending: boolean;
  run: (action: () => Promise<unknown>, close?: boolean) => Promise<boolean>;
  onRowSaved?: (row: FinanceRow) => void;
  label: (key: string) => string;
  money: (value: number) => string;
  monthName: (index: number, short?: boolean) => string;
}) {
  const initialEntry =
    editor.type === "cell"
      ? data.finance_entries.find((item) => item.id === editor.entryId)
      : undefined;
  const [entry, setEntry] = useState<FinanceEntry | null>(initialEntry || null);
  const [paymentTag, setPaymentTag] = useState<FinanceEntry["payment_tag"]>(
    initialEntry?.payment_tag || "",
  );
  const [rowKind, setRowKind] = useState(
    editor.type === "row" ? editor.row?.kind || editor.position?.kind || "expense" : "expense",
  );
  const [rowTag, setRowTag] = useState<ExpenseRowTag>(
    editor.type === "row" && editor.row?.kind === "expense"
      ? (financeRowTag(editor.row) as ExpenseRowTag)
      : "",
  );
  const {
    expense_type: expenseType,
    bill_type: billType,
    is_loan: isLoan,
    is_rent: isRent,
  } = financeRowTagValues(rowKind === "expense" ? rowTag : "");
  const acceptsPaymentCard = rowKind === "expense" && expenseType !== "credit_card";
  const isIncome = editor.type === "cell" && editor.row.kind !== "expense";
  const editorMonth = "month" in editor ? `${year}-${String(editor.month).padStart(2, "0")}` : "";
  const statementLink =
    editor.type === "cell" && editor.row.expense_type === "credit_card"
      ? data.finance_statement_links?.find(
          (link) => link.row_id === editor.row.id && link.month === editorMonth,
        )
      : undefined;
  const defaultStatus = isIncome && editorMonth <= today.slice(0, 7) ? "settled" : "planned";
  const [status, setStatus] = useState<"planned" | "settled">(
    initialEntry?.status || defaultStatus,
  );
  const statusLabel = (value: "planned" | "settled") =>
    label(
      isIncome
        ? value === "settled"
          ? "income_received"
          : "income_expected"
        : value === "settled"
          ? "expense_paid"
          : "expense_pending",
    );
  const [confirmDelete, setConfirmDelete] = useState(
    editor.type === "row" && !!editor.confirmDelete,
  );
  const referenceYear = editor.type === "reference" ? (editor.year ?? year) : year;
  const month =
    "month" in editor ? `${referenceYear}-${String(editor.month).padStart(2, "0")}` : `${year}-01`;
  const reference = data.finance_benchmarks.find((item) => item.month === month);
  const entries =
    editor.type === "cell"
      ? data.finance_entries
          .filter((item) => item.row_id === editor.row.id && item.date.startsWith(month))
          .sort((a, b) => a.date.localeCompare(b.date))
      : [];
  const title =
    editor.type === "row"
      ? editor.row?.id
        ? label("edit")
        : editor.position
          ? label(`insert_${editor.position.side}`)
          : label("new_row")
      : editor.type === "cell"
        ? `${editor.row.name} · ${monthName(editor.month - 1)}`
        : editor.type === "plan"
          ? `${editor.row.name} · ${label("plan")}`
          : `${label("reference")} · ${month}`;
  const help =
    editor.type === "row" && onRowSaved
      ? "card_payment_setup_help"
      : editor.type === "cell"
        ? "entry_help"
        : editor.type === "plan"
          ? "plan_help"
          : editor.type === "reference"
            ? "reference_help"
            : "currency";
  const field = (name: string, input: React.ReactNode) => (
    <div className="space-y-1.5">
      <Label htmlFor={`finance-${name}`}>
        {label(
          name === "name" && editor.type === "row"
            ? rowKind === "expense"
              ? "expense_name"
              : "income_name"
            : name,
        )}
      </Label>
      {input}
    </div>
  );
  const input = (
    name: string,
    type: string,
    value?: string | number,
    extra: React.InputHTMLAttributes<HTMLInputElement> = {},
  ) =>
    field(
      name,
      <Input
        id={`finance-${name}`}
        name={name}
        type={type}
        className={type === "number" ? "text-right tabular-nums" : undefined}
        defaultValue={value}
        placeholder={
          name === "name"
            ? label(rowKind === "expense" ? "expense_name" : "income_name")
            : undefined
        }
        {...extra}
      />,
    );
  const remove = (collection: keyof FinanceData, id: string) => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    void run(() => financeService.remove(collection, id, year), editor.type !== "cell").then(
      (success) => {
        if (!success) return;
        setConfirmDelete(false);
        setEntry(null);
        setPaymentTag("");
        setStatus(defaultStatus);
      },
    );
  };
  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const value = (key: string) => String(form.get(key) ?? "");
    const number = (key: string) => Number(value(key));
    if (editor.type === "row") {
      const row = editor.row;
      const saveRow = (values: Partial<FinanceRow>) =>
        editor.position
          ? financeService.rowAction(
              editor.position.rowId,
              `insert_${editor.position.side}`,
              editor.position.expectedOrder,
              values,
              year,
            )
          : financeService.save("finance_rows", values, row?.id, year);
      void run(() =>
        saveRow({
          name: value("name").trim(),
          kind: rowKind,
          notes: value("notes"),
          ...(isLoan || editor.row?.is_loan ? { is_loan: isLoan } : {}),
          ...(isRent || editor.row?.is_rent ? { is_rent: isRent } : {}),
          ...(billType || editor.row?.bill_type
            ? {
                bill_type: billType,
              }
            : {}),
          ...(value("payment_card") || editor.row?.payment_card
            ? {
                payment_card: acceptsPaymentCard ? value("payment_card") : "",
              }
            : {}),
          ...(expenseType || (editor.type === "row" && editor.row?.expense_type)
            ? { expense_type: expenseType }
            : {}),
        }),
      ).then((saved) => {
        if (saved && row)
          onRowSaved?.({
            ...row,
            name: value("name").trim(),
            kind: rowKind,
            expense_type: expenseType,
            is_loan: isLoan,
            is_rent: isRent,
            bill_type: billType,
            payment_card: acceptsPaymentCard ? value("payment_card") : "",
          });
      });
    }
    if (editor.type === "cell")
      void run(() =>
        financeService.save(
          "finance_entries",
          {
            row_id: editor.row.id,
            date: value("date"),
            amount: number("amount"),
            status: value("status"),
            settled_date: value("status") === "settled" ? value("settled_date") : "",
            notes: value("notes"),
            ...(canTagPayment(editor.row) && (value("payment_tag") || entry?.payment_tag)
              ? { payment_tag: value("payment_tag") }
              : {}),
          },
          entry?.id,
        ),
      );
    if (editor.type === "plan")
      void run(async () => {
        const result = await financeService.plan({
          row_id: editor.row.id,
          year,
          from_month: number("from"),
          to_month: number("to"),
          day: number("day"),
          amount: number("amount"),
          notes: value("notes"),
        });
        toast.success(label("plan_done").replace("{{count}}", String(result.created)));
      });
    if (editor.type === "reference")
      void run(() =>
        financeService.save("finance_benchmarks", {
          month,
          usd: number("usd"),
          eur: number("eur"),
          minimum_wage: number("minimum"),
          rate_date: value("rate_date"),
        }),
      );
  };
  return (
    <>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{label(help)}</DialogDescription>
      </DialogHeader>
      {editor.type === "cell" && editor.row.kind === "expense" && editor.row.bill_type && (
        <FinanceRowProvider
          row={editor.row}
          year={year}
          month={editor.month}
          monthName={monthName}
        />
      )}
      {statementLink && (
        <StatementLink
          statementId={statementLink.statement_id}
          className="text-sm text-blue-700 underline underline-offset-4 dark:text-blue-300"
        >
          {label("statement_linked")} · {label("go_statement")}
        </StatementLink>
      )}
      {statementLink && data.card_payment_checks?.[statementLink.id] && (
        <FinanceCardPaymentComparison check={data.card_payment_checks[statementLink.id]} />
      )}
      {editor.type === "cell" && (
        <div className="max-h-56 space-y-2 overflow-auto">
          {entries.length ? (
            entries.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-3 rounded-xl border p-3 text-sm"
              >
                <div>
                  <p
                    className={cn(
                      "font-medium",
                      isIncome
                        ? item.status === "settled"
                          ? "text-foreground"
                          : "text-blue-600 dark:text-blue-300"
                        : item.status === "planned" && "text-amber-700 dark:text-amber-400",
                    )}
                  >
                    {money(item.amount)} · {statusLabel(item.status)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {item.date}
                    {item.settled_date && ` → ${item.settled_date}`}
                  </p>
                  {isCardPaid(item, editor.row) && (
                    <p className="text-xs text-violet-700 dark:text-violet-300">
                      {label("tag_credit_card_help")}
                    </p>
                  )}
                  {item.payment_tag === "direct" && (
                    <p className="text-xs text-green-700 dark:text-green-300">
                      {label("tag_direct")}
                    </p>
                  )}
                  {item.notes && (
                    <p className="mt-1 break-words text-xs text-muted-foreground">{item.notes}</p>
                  )}
                  {data.entry_verifications?.[item.id] && (
                    <p
                      className={
                        data.entry_verifications[item.id] === "verified"
                          ? "text-xs text-emerald-700 dark:text-emerald-300"
                          : "text-xs text-amber-700 dark:text-amber-300"
                      }
                    >
                      {label(
                        data.entry_verifications[item.id] === "verified"
                          ? "statement_verified"
                          : "statement_changed",
                      )}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {item.status === "planned" && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={pending}
                      onClick={() =>
                        void run(() =>
                          financeService.save(
                            "finance_entries",
                            { status: "settled", settled_date: today },
                            item.id,
                          ),
                        )
                      }
                    >
                      {label(isIncome ? "mark_received" : "mark_paid")}
                    </Button>
                  )}
                  <Button
                    size="icon"
                    variant="ghost"
                    disabled={pending}
                    aria-label={label("edit")}
                    onClick={() => {
                      setEntry(item);
                      setPaymentTag(item.payment_tag || "");
                      setStatus(item.status);
                      setConfirmDelete(false);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">{label("empty_month")}</p>
          )}
        </div>
      )}
      <form key={entry?.id || "new"} onSubmit={submit} className="space-y-4">
        <fieldset disabled={pending} className="space-y-4">
          {editor.type === "row" && (
            <>
              {input("name", "text", editor.row?.name, { required: true, maxLength: 160 })}
              {rowKind === "expense" && billType && editor.row?.id && (
                <FinanceRowProvider row={editor.row} year={year} monthName={monthName} />
              )}
              {field(
                "kind",
                <select
                  id="finance-kind"
                  name="kind"
                  disabled={!!editor.position}
                  value={rowKind === "salary" ? "income" : rowKind}
                  onChange={(event) => setRowKind(event.target.value as FinanceRow["kind"])}
                  className={financeSelectClass}
                >
                  {["income", "expense"].map((kind) => (
                    <option key={kind} value={kind}>
                      {label(kind === "income" ? "income_kind" : kind)}
                    </option>
                  ))}
                </select>,
              )}
              {rowKind !== "expense" && (
                <div className="space-y-1.5">
                  {field(
                    "bill_type",
                    <select
                      id="finance-bill_type"
                      value={rowKind === "salary" ? "salary" : ""}
                      onChange={(event) =>
                        setRowKind(event.target.value === "salary" ? "salary" : "income")
                      }
                      className={financeSelectClass}
                    >
                      {INCOME_ROW_TAGS.map((tag) => (
                        <option key={tag} value={tag}>
                          {label(tag || "bill_none")}
                        </option>
                      ))}
                    </select>,
                  )}
                  <p className="text-xs text-muted-foreground">{label("salary_row_tag_help")}</p>
                </div>
              )}
              {rowKind === "expense" && (
                <div className="space-y-1.5">
                  {field(
                    "bill_type",
                    <select
                      id="finance-bill_type"
                      name="bill_type"
                      value={rowTag}
                      onChange={(event) => setRowTag(event.target.value as ExpenseRowTag)}
                      className={financeSelectClass}
                    >
                      {ROW_TAGS.map((tag) => (
                        <option key={tag} value={tag}>
                          {label(
                            tag === "loan" || tag === "credit_card" || tag === "rent"
                              ? tag
                              : tag
                                ? `bill_${tag}`
                                : "bill_none",
                          )}
                        </option>
                      ))}
                    </select>,
                  )}
                  <p className="text-xs text-muted-foreground">
                    {label(expenseType === "credit_card" ? "card_row_tag_help" : "bill_type_help")}
                  </p>
                  {expenseType !== "credit_card" && (
                    <>
                      {field(
                        "payment_card",
                        <select
                          id="finance-payment_card"
                          name="payment_card"
                          defaultValue={editor.row?.payment_card || ""}
                          className={financeSelectClass}
                        >
                          <option value="">{label("direct_payment")}</option>
                          {data.finance_rows
                            .filter(
                              (row) =>
                                row.expense_type === "credit_card" && row.id !== editor.row?.id,
                            )
                            .map((row) => (
                              <option key={row.id} value={row.id}>
                                {row.name}
                              </option>
                            ))}
                        </select>,
                      )}
                      <p className="text-xs text-muted-foreground">{label("payment_card_help")}</p>
                    </>
                  )}
                </div>
              )}
            </>
          )}
          {editor.type === "cell" && (
            <>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium">
                  {entry ? label("edit") : label("add_entry")}
                </h3>
                {entry && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setEntry(null);
                      setPaymentTag("");
                      setStatus(defaultStatus);
                      setConfirmDelete(false);
                    }}
                  >
                    <Plus className="mr-1 h-3 w-3" />
                    {label("add_entry")}
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                {input("amount", "number", entry?.amount, {
                  min: 0,
                  max: 1e12,
                  step: "0.01",
                  required: true,
                })}
                {input("date", "date", entry?.date || `${month}-01`, {
                  min: `${month}-01`,
                  max: `${month}-${new Date(Date.UTC(year, editor.month, 0)).getUTCDate()}`,
                  required: true,
                })}
              </div>
              {field(
                "status",
                <select
                  id="finance-status"
                  name="status"
                  value={status}
                  onChange={(event) => setStatus(event.target.value as "planned" | "settled")}
                  className={financeSelectClass}
                >
                  <option value="planned">{statusLabel("planned")}</option>
                  <option value="settled">{statusLabel("settled")}</option>
                </select>,
              )}
              {canTagPayment(editor.row) && (
                <div className="space-y-1.5">
                  {field(
                    "payment_tag",
                    <select
                      id="finance-payment_tag"
                      name="payment_tag"
                      value={paymentTag}
                      onChange={(event) =>
                        setPaymentTag(event.target.value as FinanceEntry["payment_tag"])
                      }
                      className={financeSelectClass}
                    >
                      <option value="">{label("tag_inherit")}</option>
                      <option value="credit_card">{label("tag_credit_card")}</option>
                      <option value="direct">{label("tag_direct")}</option>
                    </select>,
                  )}
                  <p className="text-xs text-muted-foreground">{label("payment_tag_help")}</p>
                </div>
              )}
              {status === "settled" &&
                input("settled_date", "date", entry?.settled_date || today, {
                  required: true,
                  max: today,
                })}
            </>
          )}
          {editor.type === "plan" && (
            <>
              <div className="grid grid-cols-2 gap-3">
                {field(
                  "from",
                  <select
                    id="finance-from"
                    name="from"
                    defaultValue={1}
                    className={financeSelectClass}
                  >
                    {Array.from({ length: 12 }, (_, index) => (
                      <option key={index} value={index + 1}>
                        {monthName(index)}
                      </option>
                    ))}
                  </select>,
                )}
                {field(
                  "to",
                  <select
                    id="finance-to"
                    name="to"
                    defaultValue={12}
                    className={financeSelectClass}
                  >
                    {Array.from({ length: 12 }, (_, index) => (
                      <option key={index} value={index + 1}>
                        {monthName(index)}
                      </option>
                    ))}
                  </select>,
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                {input("day", "number", 1, { min: 1, max: 31, required: true })}
                {input("amount", "number", undefined, {
                  min: 0,
                  max: 1e12,
                  step: "0.01",
                  required: true,
                })}
              </div>
            </>
          )}
          {editor.type === "reference" && (
            <>
              {input("usd", "number", reference?.usd || "", {
                min: 0,
                step: "0.000001",
                autoFocus: editor.field === "usd",
              })}
              {input("eur", "number", reference?.eur || "", {
                min: 0,
                step: "0.000001",
                autoFocus: editor.field === "eur",
              })}
              {input("minimum", "number", reference?.minimum_wage || "", {
                min: 0,
                step: "0.01",
                autoFocus: editor.field === "minimum",
              })}
              {input("rate_date", "date", reference?.rate_date, {
                max:
                  `${month}-31` < today
                    ? `${month}-${new Date(Date.UTC(referenceYear, editor.month, 0)).getUTCDate()}`
                    : today,
              })}
              {reference && (
                <p className="text-xs text-muted-foreground">
                  {label("source")}: {reference.source} · {label("fetched")}:{" "}
                  {reference.updated_at.slice(0, 10)}
                </p>
              )}
            </>
          )}
          {["row", "cell", "plan"].includes(editor.type) &&
            field(
              "notes",
              <textarea
                id="finance-notes"
                name="notes"
                defaultValue={
                  editor.type === "row"
                    ? editor.row?.notes
                    : editor.type === "cell"
                      ? entry?.notes
                      : ""
                }
                maxLength={2000}
                rows={3}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />,
            )}
          {editor.type === "row" && editor.row?.id && (
            <p className="text-xs text-muted-foreground">{label("delete_row_help")}</p>
          )}
          <div className="flex items-center justify-between gap-3 pt-2">
            <div>
              {((editor.type === "row" && editor.row?.id) || (editor.type === "cell" && entry)) && (
                <Button
                  type="button"
                  variant="destructive"
                  id="finance-delete"
                  size="sm"
                  onClick={() => {
                    if (editor.type === "row") remove("finance_rows", editor.row!.id);
                    if (editor.type === "cell") remove("finance_entries", entry!.id);
                  }}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  {label(confirmDelete ? "confirm_delete" : "delete")}
                </Button>
              )}
            </div>
            <Button type="submit" disabled={pending}>
              {label("save")}
            </Button>
          </div>
        </fieldset>
      </form>
    </>
  );
}
