import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDownToLine,
  Check,
  CircleCheck,
  FileText,
  FolderOpen,
  Info,
  Loader2,
  Plus,
  Trash2,
  TriangleAlert,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Trans, useTranslation } from "react-i18next";

import { StatementBankLogo } from "@/components/StatementBankLogo";
import { StatementDateInput } from "@/components/StatementDateInput";
import {
  StatementImportDialog,
  type StatementImportResult,
} from "@/components/StatementImportDialog";
import { SubscriptionLogo } from "@/components/SubscriptionLogo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { ThemedSelect } from "@/components/ui/themed-select";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import client from "@/lib/client";
import { queryKeys } from "@/lib/queryKeys";
import {
  detectStatement,
  parseStatement,
  type ReviewTransaction,
  type SavedStatement,
  STATEMENT_BANKS,
  type StatementBank,
  type StatementLine,
  statementTotals,
  validStatementDate,
} from "@/lib/statements";
import {
  createSubscriptionMatcher,
  filterSubscriptionLines,
  filterSubscriptionTransactions,
  isStatementOnlyTransaction,
} from "@/lib/statementSubscriptions";
import { subscriptionsService } from "@/services/subscriptions";

const selectClass = "h-10 rounded-xl px-3 text-sm";
const localMonth = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
};
type StatementSummary = Pick<
  SavedStatement,
  "id" | "bank" | "period" | "file_name" | "created" | "page_count"
>;

export function StatementsPage() {
  const { user } = useAuth();
  return user ? <StatementWorkspace key={user.id} userId={user.id} /> : null;
}

function StatementWorkspace({ userId }: { userId: string }) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const controller = useRef<AbortController | null>(null);
  const requestId = useRef(0);
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState("");
  const [bank, setBank] = useState<StatementBank | "">("");
  const [period, setPeriod] = useState(localMonth);
  const [lines, setLines] = useState<StatementLine[]>([]);
  const [rows, setRows] = useState<ReviewTransaction[]>([]);
  const [unresolved, setUnresolved] = useState<StatementLine[]>([]);
  const [metadata, setMetadata] = useState<{
    file_hash: string;
    page_count: number;
    file_name: string;
  } | null>(null);
  const [emptyPages, setEmptyPages] = useState(0);
  const [excluded, setExcluded] = useState(0);
  const [refunded, setRefunded] = useState(0);
  const [unmatchedRefunds, setUnmatchedRefunds] = useState(0);
  const [reviewed, setReviewed] = useState(false);
  const [busy, setBusy] = useState("");
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [viewing, setViewing] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importResult, setImportResult] = useState<StatementImportResult | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteAllOpen, setDeleteAllOpen] = useState(false);
  const [page, setPage] = useState(0);
  const [archivePage, setArchivePage] = useState(1);
  const archiveKey = ["bank-statements", userId] as const;
  const subscriptions = useQuery({
    queryKey: queryKeys.subscriptions.all(userId),
    queryFn: () => subscriptionsService.list(userId),
  });
  const matchSubscription = useMemo(
    () => createSubscriptionMatcher(subscriptions.data ?? []),
    [subscriptions.data],
  );
  const archive = useQuery({
    queryKey: [...archiveKey, archivePage],
    queryFn: () =>
      client.collection("bank_statements").getList<StatementSummary>(archivePage, 12, {
        sort: "-period,-created",
        fields: "id,bank,period,file_name,page_count,created",
      }),
  });

  useEffect(
    () => () => {
      requestId.current++;
      controller.current?.abort();
    },
    [],
  );
  const included = useMemo(
    () => rows.filter((row) => row.included && row.kind !== "refund"),
    [rows],
  );
  const totals = useMemo(() => statementTotals(included), [included]);
  const outsideStatementPeriod = (date: string) =>
    validStatementDate(date) &&
    /^20\d{2}-(0[1-9]|1[0-2])$/.test(period) &&
    date.slice(0, 7) !== period;
  const valid =
    included.length > 0 &&
    included.length <= 3000 &&
    included.every(
      (row) =>
        validStatementDate(row.date) &&
        row.merchant.trim() &&
        row.merchant.length <= 250 &&
        typeof row.subscription_service === "string" &&
        !!row.subscription_service.trim() &&
        row.subscription_service.length <= 120 &&
        !!row.subscription_match &&
        row.kind === "charge" &&
        Number.isFinite(row.amount) &&
        row.amount >= 0 &&
        row.amount <= 100000000 &&
        Math.abs(row.amount * 100 - Math.round(row.amount * 100)) < 0.00001,
    );
  const money = (amount: number, currency: string) =>
    new Intl.NumberFormat(i18n.language.replace("_", "-"), { style: "currency", currency }).format(
      amount,
    );
  const monthLabel = (value: string) =>
    new Intl.DateTimeFormat(i18n.language.replace("_", "-"), {
      month: "long",
      year: "numeric",
    }).format(new Date(`${value}-15T12:00:00`));

  function clear() {
    requestId.current++;
    controller.current?.abort();
    controller.current = null;
    setRows([]);
    setLines([]);
    setUnresolved([]);
    setMetadata(null);
    setViewing(null);
    setImportOpen(false);
    setImportResult(null);
    setReviewed(false);
    setSuccess(false);
    setError("");
    setProgress("");
    setBusy("");
    setEmptyPages(0);
    setExcluded(0);
    setRefunded(0);
    setUnmatchedRefunds(0);
    setPage(0);
  }
  function chooseFile(selected: File | null) {
    clear();
    setFile(selected);
    setPassword("");
    setBank("");
    setPeriod(localMonth());
  }
  function update(id: string, patch: Partial<ReviewTransaction>) {
    setRows((current) =>
      current.map((row): ReviewTransaction => {
        if (row.id !== id) return row;
        if (patch.merchant !== undefined && row.subscription_match !== "manual") {
          const match = matchSubscription(patch.merchant);
          return {
            ...row,
            ...patch,
            subscription_service: match?.service ?? "",
            subscription_match: match?.source ?? "manual",
            uncertain: true,
            included: row.included && !!match && !match.possible,
          };
        }
        return { ...row, ...patch };
      }),
    );
    setReviewed(false);
    setSuccess(false);
  }
  function parse(source: StatementLine[], selectedPeriod: string) {
    const parsed = parseStatement(source, selectedPeriod);
    const filtered = filterSubscriptionTransactions(parsed.transactions, matchSubscription);
    setRows(filtered.transactions);
    setExcluded(filtered.excluded);
    setRefunded(filtered.refunded);
    setUnmatchedRefunds(filtered.unmatchedRefunds);
    setUnresolved(filterSubscriptionLines(parsed.unresolved, matchSubscription));
    setPage(0);
    setReviewed(false);
    setSuccess(false);
  }
  async function extract() {
    if (!file || busy || subscriptions.isPending) return;
    clear();
    const operation = ++requestId.current;
    const aborter = new AbortController();
    controller.current = aborter;
    setBusy("read");
    try {
      const { readStatementPdf } = await import("@/lib/statementPdf");
      if (operation !== requestId.current) return;
      const result = await readStatementPdf(
        file,
        password,
        (current, total) => {
          if (operation === requestId.current)
            setProgress(t("statement_progress", { current, total }));
        },
        aborter.signal,
      );
      if (operation !== requestId.current) return;
      const detected = detectStatement(result.lines);
      const selectedPeriod = detected.period || period;
      setBank(bank || detected.bank);
      setPeriod(selectedPeriod);
      setMetadata({
        file_hash: result.fileHash,
        page_count: result.pageCount,
        file_name: file.name,
      });
      setLines(result.lines);
      setEmptyPages(result.emptyPages);
      setPassword("");
      parse(result.lines, selectedPeriod);
    } catch (err) {
      if (operation !== requestId.current || aborter.signal.aborted) return;
      const key =
        err instanceof Error && err.name === "PasswordException"
          ? "statement_password_error"
          : err instanceof Error && err.message.startsWith("statement_")
            ? err.message
            : "statement_read_failed";
      setError(t(key));
    } finally {
      if (operation === requestId.current) {
        setBusy("");
        setProgress("");
      }
    }
  }
  async function save() {
    if (!metadata || !bank || !valid || !reviewed || busy || viewing) return;
    setBusy("save");
    setError("");
    try {
      const saved = await api.post<{ id: string }>("/api/statements", {
        ...metadata,
        bank,
        period,
        transactions: included.map(
          ({
            id,
            date,
            merchant,
            amount,
            currency,
            kind,
            page: sourcePage,
            installment,
            subscription_service,
            subscription_match,
          }) => ({
            id,
            date,
            merchant,
            amount,
            currency,
            kind,
            page: sourcePage,
            installment,
            subscription_service,
            subscription_match,
          }),
        ),
      });
      setViewing(saved.id);
      setRows(included);
      setLines([]);
      setUnresolved([]);
      setFile(null);
      setSuccess(true);
      setPage(0);
      setArchivePage(1);
      await queryClient.invalidateQueries({ queryKey: archiveKey });
      setImportOpen(included.some((row) => !isStatementOnlyTransaction(row)));
    } catch (err) {
      setError(
        t(
          err instanceof Error && err.message.startsWith("statement_")
            ? err.message
            : "statement_save_failed",
        ),
      );
    } finally {
      setBusy("");
    }
  }
  async function openStatement(id: string) {
    if (busy) return;
    clear();
    setFile(null);
    setPassword("");
    setBusy("open");
    try {
      const saved = await client.collection("bank_statements").getOne<SavedStatement>(id);
      setViewing(id);
      setBank(saved.bank);
      setPeriod(saved.period);
      setMetadata({
        file_hash: saved.file_hash,
        page_count: saved.page_count,
        file_name: saved.file_name,
      });
      setRows(
        saved.transactions
          .filter((row) => row.kind !== "refund")
          .map((row) => ({ ...row, included: true, uncertain: false, source: "" })),
      );
    } catch {
      setError(t("statement_load_failed"));
    } finally {
      setBusy("");
    }
  }
  async function deleteStatement() {
    if (!deleteId || busy) return;
    const id = deleteId;
    setDeleteId(null);
    setBusy("delete");
    setError("");
    try {
      await client.collection("bank_statements").delete(id);
      if (viewing === id) clear();
      setArchivePage(1);
      await queryClient.invalidateQueries({ queryKey: archiveKey });
    } catch {
      setError(t("statement_delete_failed"));
    } finally {
      setBusy("");
    }
  }

  async function deleteAllStatements() {
    if (busy) return;
    setDeleteAllOpen(false);
    setBusy("delete-all");
    setError("");
    try {
      await api.post<{ deleted: number }>("/api/statements/delete-all", { confirmed: true });
      if (viewing) {
        clear();
        setBusy("delete-all");
      }
      setDeleteId(null);
      setArchivePage(1);
      await queryClient.invalidateQueries({ queryKey: archiveKey });
    } catch {
      setError(t("statement_delete_failed"));
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3 rounded-xl border border-orange-400/40 bg-orange-500/10 p-4 text-sm text-orange-800 dark:text-orange-200">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-orange-500" aria-hidden="true" />
        <p>
          <Trans
            i18nKey="statement_import_prepare_note"
            components={{
              categories: (
                <a
                  href="/settings?tab=categories"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-bold underline underline-offset-2"
                />
              ),
              paymentMethods: (
                <a
                  href="/settings?tab=payment_methods"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-bold underline underline-offset-2"
                />
              ),
            }}
          />
        </p>
      </div>
      <Card className="overflow-hidden rounded-3xl">
        <CardHeader className="border-b bg-muted/20">
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileText className="h-5 w-5 text-primary" />
            {t("statement_upload")}
          </CardTitle>
          <p className="text-sm leading-relaxed text-muted-foreground">{t("statement_intro")}</p>
        </CardHeader>
        <CardContent className="space-y-5 pt-6">
          <p className="rounded-xl border bg-muted/10 p-3 text-sm text-muted-foreground">
            {t("statement_privacy")}
          </p>
          <div className="grid items-end gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="grid min-w-0 gap-2 md:col-span-2">
              <label htmlFor="statement-pdf-file" className="text-sm font-medium leading-5">
                {t("statement_file")}
              </label>
              <input
                id="statement-pdf-file"
                ref={fileInput}
                type="file"
                accept=".pdf,application/pdf"
                className="hidden"
                disabled={!!busy}
                onChange={(event) => {
                  chooseFile(event.target.files?.[0] ?? null);
                  event.target.value = "";
                }}
              />
              <div className="flex h-11 min-w-0 items-center gap-3 rounded-xl border border-input bg-background px-3">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 shrink-0 rounded-lg"
                  disabled={!!busy}
                  onClick={() => fileInput.current?.click()}
                >
                  <FolderOpen className="mr-2 h-4 w-4" />
                  {t("statement_choose")}
                </Button>
                <span className="min-w-0 truncate text-sm text-muted-foreground" title={file?.name}>
                  {file?.name || t("statement_no_file")}
                </span>
              </div>
            </div>
            <label className="grid min-w-0 gap-2 text-sm font-medium">
              <span className="leading-5">{t("statement_bank")}</span>
              <ThemedSelect
                className="h-11 w-full min-w-0 rounded-xl px-3 text-sm"
                value={bank}
                disabled={!!busy || !!viewing}
                onChange={(event) => {
                  setBank(event.target.value as StatementBank | "");
                  setReviewed(false);
                }}
              >
                <option value="">{t("statement_auto_bank")}</option>
                {Object.entries(STATEMENT_BANKS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </ThemedSelect>
            </label>
            <label className="grid min-w-0 gap-2 text-sm font-medium">
              <span className="leading-5">{t("statement_period")}</span>
              <Input
                type="month"
                className="h-11 min-w-0 rounded-xl"
                value={period}
                min="2000-01"
                max="2099-12"
                disabled={!!busy || !!viewing}
                onChange={(event) => {
                  setPeriod(event.target.value);
                  setReviewed(false);
                }}
              />
            </label>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <label className="grid w-full gap-2 text-sm font-medium sm:w-72">
              <span className="leading-5">{t("statement_password")}</span>
              <Input
                type="password"
                autoComplete="off"
                value={password}
                disabled={!!busy || !file || !!viewing}
                onChange={(event) => setPassword(event.target.value)}
                className="h-11 rounded-xl"
              />
            </label>
            <Button
              className="h-11 rounded-xl"
              disabled={
                !file ||
                !!busy ||
                subscriptions.isPending ||
                !/^20\d{2}-(0[1-9]|1[0-2])$/.test(period)
              }
              onClick={extract}
            >
              {busy === "read" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FileText className="mr-2 h-4 w-4" />
              )}
              {t("statement_read")}
            </Button>
            {busy === "read" && (
              <Button className="h-11 rounded-xl" variant="outline" onClick={clear}>
                {t("cancel")}
              </Button>
            )}
          </div>
          {progress && (
            <p role="status" className="text-sm text-muted-foreground">
              {progress}
            </p>
          )}
          {subscriptions.isError && (
            <p role="status" className="text-sm text-muted-foreground">
              {t("statement_account_match_unavailable")}
            </p>
          )}
          {error && (
            <p
              role="alert"
              className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
            >
              {error}
            </p>
          )}
          {success && (
            <p role="status" className="flex items-center gap-2 text-sm text-foreground">
              <Check className="h-4 w-4 text-primary" />
              {t("statement_saved")}
            </p>
          )}
        </CardContent>
      </Card>

      {metadata && (
        <Card className="overflow-hidden rounded-3xl">
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 border-b bg-muted/20">
            <div className="min-w-0 space-y-1">
              <CardTitle className="text-lg">
                {t(viewing ? "statement_saved_list" : "statement_review")}
              </CardTitle>
              <p className="break-all text-sm text-muted-foreground">
                {metadata.file_name} ·{" "}
                {/^20\d{2}-(0[1-9]|1[0-2])$/.test(period) ? monthLabel(period) : "—"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {viewing && rows.some((row) => !isStatementOnlyTransaction(row)) && (
                <Button variant="outline" disabled={!!busy} onClick={() => setImportOpen(true)}>
                  <ArrowDownToLine className="mr-2 h-4 w-4" />
                  {t("statement_import_title")}
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                aria-label={t("close")}
                onClick={() => {
                  clear();
                  setFile(null);
                  setPassword("");
                }}
                disabled={!!busy}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-5 pt-6">
            {rows.some(isStatementOnlyTransaction) && (
              <p className="rounded-xl border bg-muted/30 p-3 text-sm text-muted-foreground">
                {t("statement_import_one_off")}
              </p>
            )}
            {importResult && (
              <p role="status" className="rounded-xl border bg-primary/10 p-3 text-sm">
                {t("statement_import_result", {
                  created: importResult.subscriptions_created,
                  imported: importResult.payments_imported,
                  skipped: importResult.payments_skipped,
                })}
              </p>
            )}
            {!viewing && (
              <p className="text-sm leading-relaxed text-muted-foreground">
                {t("statement_review_note")}
              </p>
            )}
            {!viewing && excluded > 0 && (
              <p
                role="status"
                className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm leading-relaxed text-blue-900 dark:border-blue-400/30 dark:bg-blue-500/10 dark:text-blue-200"
              >
                <Info
                  aria-hidden="true"
                  className="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400"
                />
                <span>{t("statement_excluded", { count: excluded })}</span>
              </p>
            )}
            {!viewing && refunded > 0 && (
              <p
                role="status"
                className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm leading-relaxed text-emerald-900 dark:border-emerald-400/30 dark:bg-emerald-500/10 dark:text-emerald-200"
              >
                <CircleCheck
                  aria-hidden="true"
                  className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400"
                />
                <span>{t("statement_refunded_charges_excluded", { count: refunded })}</span>
              </p>
            )}
            {!viewing && unmatchedRefunds > 0 && (
              <p
                role="status"
                className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm leading-relaxed text-amber-900 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-200"
              >
                <TriangleAlert
                  aria-hidden="true"
                  className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400"
                />
                <span>{t("statement_unmatched_refunds", { count: unmatchedRefunds })}</span>
              </p>
            )}
            {!!emptyPages && (
              <p className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
                {t("statement_empty_pages", { count: emptyPages })}
              </p>
            )}
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {Object.entries(totals).map(([currency, total]) => (
                <div key={currency} className="space-y-2 rounded-2xl border bg-muted/10 p-4">
                  <p className="text-xs font-medium text-muted-foreground">
                    {currency} · {t("statement_net")}
                  </p>
                  <p className="text-2xl font-semibold tabular-nums">
                    {money(total.spending, currency)}
                  </p>
                  {total.repayments > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {t("statement_repayments")}: {money(total.repayments, currency)}
                    </p>
                  )}
                </div>
              ))}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
              <span className="text-muted-foreground">
                {t("statement_selected", { selected: included.length, total: rows.length })}
              </span>
              {!viewing && (
                <div className="flex flex-wrap gap-2">
                  {lines.length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!!busy || !/^20\d{2}-(0[1-9]|1[0-2])$/.test(period)}
                      onClick={() => parse(lines, period)}
                    >
                      {t("statement_reparse")}
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!!busy || rows.length >= 3000}
                    onClick={() => {
                      const now = new Date();
                      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
                      setRows((current) => [
                        ...current,
                        {
                          id: crypto.randomUUID(),
                          date: today,
                          merchant: "",
                          amount: 0,
                          currency: "TRY",
                          kind: "charge",
                          page: 1,
                          installment: "",
                          source: "",
                          included: true,
                          uncertain: true,
                          subscription_service: "",
                          subscription_match: "manual",
                        },
                      ]);
                      setPage(Math.floor(rows.length / 30));
                      setReviewed(false);
                    }}
                  >
                    <Plus className="mr-1 h-4 w-4" />
                    {t("statement_add_row")}
                  </Button>
                </div>
              )}
            </div>
            {!rows.length && (
              <p className="rounded-xl border p-4 text-sm text-muted-foreground">
                {t("statement_no_rows")}
              </p>
            )}
            {rows.length > 0 && (
              <div className="overflow-x-auto rounded-2xl border">
                <table className="statement-table w-full min-w-[1020px] text-sm">
                  <thead className="border-b bg-muted/30 text-left text-xs text-muted-foreground">
                    <tr>
                      {!viewing && (
                        <th className="p-3">
                          <span className="sr-only">{t("statement_include")}</span>
                        </th>
                      )}
                      <th className="p-3">{t("statement_date")}</th>
                      <th className="p-3">{t("statement_merchant")}</th>
                      <th className="p-3">{t("statement_amount")}</th>
                      <th className="p-3">{t("statement_currency")}</th>
                      <th className="p-3">{t("statement_kind")}</th>
                      <th className="p-3">{t("statement_source")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {rows.slice(page * 30, page * 30 + 30).map((row) => (
                      <tr key={row.id} className={row.included ? "" : "bg-muted/20"}>
                        {!viewing && (
                          <td className="p-3 align-top pt-5">
                            <input
                              type="checkbox"
                              className="h-4 w-4 accent-primary"
                              checked={row.included}
                              disabled={!!busy}
                              aria-label={t("statement_include_row", { merchant: row.merchant })}
                              onChange={(event) =>
                                update(row.id, { included: event.target.checked })
                              }
                            />
                          </td>
                        )}
                        <td className="p-2 align-top">
                          <StatementDateInput
                            className={
                              outsideStatementPeriod(row.date)
                                ? "border-red-500 bg-red-500/10 text-red-700 focus-visible:ring-red-500 dark:text-red-300"
                                : undefined
                            }
                            aria-describedby={
                              outsideStatementPeriod(row.date)
                                ? `statement-date-warning-${row.id}`
                                : undefined
                            }
                            title={
                              outsideStatementPeriod(row.date)
                                ? t("statement_date_outside_period")
                                : undefined
                            }
                            value={row.date}
                            disabled={!!viewing || !!busy}
                            onChange={(date) => update(row.id, { date })}
                          />
                          {outsideStatementPeriod(row.date) && (
                            <span id={`statement-date-warning-${row.id}`} className="sr-only">
                              {t("statement_date_outside_period")}
                            </span>
                          )}
                        </td>
                        <td className="min-w-64 p-2 align-top">
                          <Input
                            value={row.merchant}
                            maxLength={250}
                            aria-label={t("statement_merchant")}
                            disabled={!!viewing || !!busy}
                            onChange={(event) => update(row.id, { merchant: event.target.value })}
                          />
                          {(row.subscription_service !== undefined || !viewing) && (
                            <label className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                              <span className="shrink-0">{t("statement_subscription")}</span>
                              <div className="relative min-w-0 flex-1">
                                {!!row.subscription_service?.trim() && (
                                  <span
                                    aria-hidden="true"
                                    className="pointer-events-none absolute left-1 top-1 flex h-6 w-6 items-center justify-center overflow-hidden rounded-md border bg-background"
                                  >
                                    <SubscriptionLogo
                                      sub={{ name: row.subscription_service, url: "" }}
                                      className="h-full w-full object-contain p-0.5"
                                    />
                                  </span>
                                )}
                                <Input
                                  className={`h-8 text-xs ${row.subscription_service?.trim() ? "pl-9" : ""}`}
                                  value={row.subscription_service ?? ""}
                                  maxLength={120}
                                  placeholder={t("statement_subscription_name")}
                                  disabled={!!viewing || !!busy}
                                  onChange={(event) =>
                                    update(row.id, {
                                      subscription_service: event.target.value,
                                      subscription_match: "manual",
                                    })
                                  }
                                />
                              </div>
                            </label>
                          )}
                          {row.subscription_match && (
                            <span className="mt-1 block text-xs text-muted-foreground">
                              {t(`statement_match_${row.subscription_match}`)}
                            </span>
                          )}
                          {row.installment && (
                            <span className="mt-1 block text-xs text-muted-foreground">
                              {t("statement_installment")}: {row.installment}
                            </span>
                          )}
                          {!viewing && row.uncertain && (
                            <span className="mt-1 block text-xs text-amber-700 dark:text-amber-400">
                              {t("statement_check_row")}
                            </span>
                          )}
                        </td>
                        <td className="p-2 align-top">
                          <Input
                            className="w-32 tabular-nums"
                            type="number"
                            min="0"
                            max="100000000"
                            step="0.01"
                            aria-label={t("statement_amount")}
                            value={Number.isNaN(row.amount) ? "" : row.amount}
                            disabled={!!viewing || !!busy}
                            onChange={(event) =>
                              update(row.id, {
                                amount:
                                  event.target.value === "" ? NaN : Number(event.target.value),
                              })
                            }
                          />
                        </td>
                        <td className="p-2 align-top">
                          <ThemedSelect
                            className={selectClass}
                            aria-label={t("statement_currency")}
                            value={row.currency}
                            disabled={!!viewing || !!busy}
                            onChange={(event) => update(row.id, { currency: event.target.value })}
                          >
                            {["TRY", "USD", "EUR", "GBP"].map((code) => (
                              <option key={code}>{code}</option>
                            ))}
                          </ThemedSelect>
                        </td>
                        <td className="p-3 align-top text-muted-foreground">
                          {t(`statement_kind_${row.kind}`)}
                        </td>
                        <td className="max-w-64 p-3 align-top text-xs text-muted-foreground">
                          {row.source ? (
                            <details>
                              <summary className="cursor-pointer whitespace-nowrap">
                                {t("statement_page", { page: row.page })}
                              </summary>
                              <p className="mt-2 min-w-48 whitespace-normal break-words select-text">
                                {row.source}
                              </p>
                            </details>
                          ) : (
                            t("statement_page", { page: row.page })
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {rows.length > 30 && (
              <div className="flex items-center justify-end gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 0}
                  onClick={() => setPage((current) => current - 1)}
                >
                  {t("statement_previous")}
                </Button>
                <span className="text-sm text-muted-foreground">
                  {page + 1} / {Math.ceil(rows.length / 30)}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={(page + 1) * 30 >= rows.length}
                  onClick={() => setPage((current) => current + 1)}
                >
                  {t("statement_next")}
                </Button>
              </div>
            )}
            {unresolved.length > 0 && (
              <details className="rounded-xl border border-amber-500/40 p-4 text-sm">
                <summary className="cursor-pointer font-medium">
                  {t("statement_unresolved", { count: unresolved.length })}
                </summary>
                <p className="mt-3 text-muted-foreground">{t("statement_unresolved_note")}</p>
                <ul className="mt-3 max-h-60 space-y-2 overflow-y-auto text-xs text-muted-foreground">
                  {unresolved.map((line, index) => (
                    <li key={index} className="select-text break-words">
                      {t("statement_page", { page: line.page })} · {line.text}
                    </li>
                  ))}
                </ul>
              </details>
            )}
            {!viewing && (
              <div className="space-y-4 border-t pt-5">
                <label className="flex items-start gap-3 text-sm leading-relaxed">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 shrink-0 accent-primary"
                    checked={reviewed}
                    disabled={!!busy}
                    onChange={(event) => setReviewed(event.target.checked)}
                  />
                  {t("statement_review_confirm")}
                </label>
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    className="disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none"
                    disabled={
                      !!busy ||
                      !bank ||
                      !valid ||
                      !reviewed ||
                      !/^20\d{2}-(0[1-9]|1[0-2])$/.test(period)
                    }
                    onClick={save}
                  >
                    {busy === "save" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {t("statement_save")}
                  </Button>
                  {error === t("statement_duplicate") && (
                    <p className="text-sm text-destructive">{error}</p>
                  )}
                </div>
                {!bank && (
                  <p className="text-sm text-muted-foreground">{t("statement_select_bank")}</p>
                )}
                {!valid && included.length > 0 && (
                  <p className="text-sm text-destructive">{t("statement_invalid_rows")}</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="rounded-3xl">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-lg">{t("statement_archive")}</CardTitle>
            <Button
              variant="outline"
              className="gap-2 rounded-xl border-destructive/40 text-destructive"
              disabled={
                !!busy ||
                archive.isLoading ||
                archive.isError ||
                !(archive.data?.totalItems ?? archive.data?.items.length)
              }
              onClick={() => setDeleteAllOpen(true)}
            >
              <Trash2 className="h-4 w-4" />
              {t("statement_delete_all")}
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">{t("statement_archive_note")}</p>
        </CardHeader>
        <CardContent className="space-y-3">
          {archive.isLoading ? (
            <Loader2 aria-label={t("loading")} className="h-5 w-5 animate-spin" />
          ) : archive.isError ? (
            <p role="alert" className="text-sm text-destructive">
              {t("statement_load_failed")}
            </p>
          ) : !archive.data?.items.length ? (
            <p className="text-sm text-muted-foreground">{t("statement_archive_empty")}</p>
          ) : (
            archive.data.items.map((saved) => (
              <div key={saved.id} className="flex items-center gap-3 rounded-2xl border p-3">
                <StatementBankLogo bank={saved.bank} />
                <button
                  disabled={!!busy}
                  onClick={() => void openStatement(saved.id)}
                  className="min-w-0 flex-1 rounded-lg text-left focus-visible:outline focus-visible:outline-ring"
                >
                  <span className="block font-medium">
                    {saved.bank ? STATEMENT_BANKS[saved.bank] : t("statement_auto_bank")} ·{" "}
                    {monthLabel(saved.period)}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {saved.file_name}
                  </span>
                </button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t("delete")}
                  disabled={!!busy}
                  onClick={() => setDeleteId(saved.id)}
                >
                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                </Button>
              </div>
            ))
          )}
          {(archive.data?.totalPages ?? 0) > 1 && (
            <div className="flex items-center justify-end gap-3">
              <Button
                variant="outline"
                size="sm"
                disabled={archivePage <= 1}
                onClick={() => setArchivePage((current) => current - 1)}
              >
                {t("statement_previous")}
              </Button>
              <span className="text-sm">
                {archivePage} / {archive.data?.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={archivePage >= (archive.data?.totalPages ?? 1)}
                onClick={() => setArchivePage((current) => current + 1)}
              >
                {t("statement_next")}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
      {importOpen && viewing && (
        <StatementImportDialog
          statementId={viewing}
          userId={userId}
          rows={rows}
          onClose={() => setImportOpen(false)}
          onImported={setImportResult}
        />
      )}
      <ConfirmDialog
        confirmOnEnter
        open={!!deleteId}
        onOpenChange={(open) => {
          if (!open) setDeleteId(null);
        }}
        title={t("statement_delete_title")}
        description={t("statement_delete_note")}
        onConfirm={() => void deleteStatement()}
      />
      <ConfirmDialog
        confirmOnEnter
        open={deleteAllOpen}
        onOpenChange={setDeleteAllOpen}
        title={t("statement_delete_all")}
        description={t("statement_delete_all_note")}
        onConfirm={() => void deleteAllStatements()}
      />
    </div>
  );
}
