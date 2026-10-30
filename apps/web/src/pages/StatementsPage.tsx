import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import {
  ArrowDownToLine,
  ArrowRight,
  Check,
  FileText,
  FolderOpen,
  Info,
  Lightbulb,
  Loader2,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Trans, useTranslation } from "react-i18next";

import { PageLoading } from "@/components/PageLoading";
import { StatementBankLogo } from "@/components/StatementBankLogo";
import { StatementDateInput } from "@/components/StatementDateInput";
import { StatementDuplicateDialog } from "@/components/StatementDuplicateDialog";
import type { StatementImportResult } from "@/components/StatementImportDialog";
import { StatementLink } from "@/components/StatementLink";
import { StatementMatchedRefunds } from "@/components/StatementMatchedRefunds";
import { StatementOverview } from "@/components/StatementOverview";
import { StatementReconciliationNotice } from "@/components/StatementReconciliationNotice";
import { StatementSavedRow } from "@/components/StatementSavedRow";
import { SubscriptionLogo } from "@/components/SubscriptionLogo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { ThemedSelect } from "@/components/ui/themed-select";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import client from "@/lib/client";
import { dialogDismissHandler } from "@/lib/dialogDismiss";
import { queryKeys } from "@/lib/queryKeys";
import { spendingKey } from "@/lib/spending";
import { statementSourceIssue, validStatementInstallment } from "@/lib/statementAmounts";
import {
  STATEMENT_CATEGORIES,
  type StatementCategory,
  statementCategory,
} from "@/lib/statementCategories";
import { hasUnresolvedStatementText, repairStatementTransactions } from "@/lib/statementDetails";
import { readStatementFile } from "@/lib/statementFile";
import { inspectStatementAccounting, statementUnitemizedFees } from "@/lib/statementReconciliation";
import {
  prepareFullStatement,
  reviewStatementRows,
  statementSubscriptionRows,
} from "@/lib/statementReport";
import { invalidReviewFields, validReviewRow } from "@/lib/statementReviewValidation";
import {
  detectStatement,
  parseStatement,
  type ReviewTransaction,
  type SavedStatement,
  STATEMENT_BANKS,
  type StatementAccountSummary,
  type StatementBank,
  type StatementLine,
  type StatementTransaction,
  validStatementDate,
} from "@/lib/statements";
import {
  createSubscriptionMatcher,
} from "@/lib/statementSubscriptions";
import { formatCurrency } from "@/lib/utils";
import {
  type StatementDuplicateResult,
  statementDuplicatesService,
} from "@/services/statementDuplicates";
import { subscriptionsService } from "@/services/subscriptions";

import { statementSourceRows } from "../../../backend/src/domain/lib/pure/statement-payments.mjs";

const selectClass = "h-10 rounded-xl px-3 text-sm";
const StatementImportDialog = lazy(() =>
  import("@/components/StatementImportDialog").then((module) => ({
    default: module.StatementImportDialog,
  })),
);
const localMonth = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
};
type StatementSummary = Pick<
  SavedStatement,
  "id" | "bank" | "period" | "file_name" | "created" | "page_count"
>;

function savedReviewRows(saved: SavedStatement): ReviewTransaction[] {
  return repairStatementTransactions(saved.transactions).map((row) => ({
    ...row,
    ...(statementSourceIssue(row) ? { amount_issue: statementSourceIssue(row), amount: NaN } : {}),
    category:
      row.category || (row.subscription_service ? "digital" : statementCategory(row.merchant)),
    included: !statementSourceIssue(row),
    uncertain: false,
    source: row.source || "",
  }));
}

export function StatementDetailPage() {
  const { statementId } = useParams({ strict: false });
  return <StatementsPage statementId={statementId} />;
}

export function StatementsPage({ statementId }: { statementId?: string } = {}) {
  const { user } = useAuth();
  return user ? (
    <StatementWorkspace
      key={`${user.id}-${statementId || "upload"}`}
      userId={user.id}
      statementId={statementId}
    />
  ) : null;
}

function StatementWorkspace({ userId, statementId }: { userId: string; statementId?: string }) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const refundsSectionRef = useRef<HTMLDetailsElement>(null);
  const controller = useRef<AbortController | null>(null);
  const requestId = useRef(0);
  const [file, setFile] = useState<File | null>(null);
  const [fileCheck, setFileCheck] = useState<"" | "checking" | "new" | "duplicate" | "error">("");
  const [password, setPassword] = useState("");
  const [bank, setBank] = useState<StatementBank | "">("");
  const [period, setPeriod] = useState(localMonth);
  const [lines, setLines] = useState<StatementLine[]>([]);
  const [summary, setSummary] = useState<StatementAccountSummary>({});
  const [categoryFilter, setCategoryFilter] = useState<StatementCategory | "all">("all");
  const [rows, setRows] = useState<ReturnType<typeof prepareFullStatement>>([]);
  const [savedExcluded, setSavedExcluded] = useState<StatementTransaction[]>([]);
  const [unresolved, setUnresolved] = useState<StatementLine[]>([]);
  const [metadata, setMetadata] = useState<{
    file_hash: string;
    page_count: number;
    file_name: string;
  } | null>(null);
  const [emptyPages, setEmptyPages] = useState(0);
  const [reviewed, setReviewed] = useState(false);
  const [differencesReviewed, setDifferencesReviewed] = useState(false);
  const [duplicateReview, setDuplicateReview] = useState<{
    key: string;
    result: StatementDuplicateResult;
  } | null>(null);
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
    enabled: !statementId,
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
    enabled: !statementId,
  });
  const detail = useQuery({
    queryKey: ["bank-statements", userId, "detail", statementId],
    queryFn: () => client.collection("bank_statements").getOne<SavedStatement>(statementId!),
    enabled: !!statementId,
    retry: false,
  });
  useEffect(() => {
    if (!detail.data) return;
    const saved = detail.data;
    setViewing(saved.id);
    setBank(saved.bank);
    setPeriod(saved.period);
    setMetadata({
      file_hash: saved.file_hash,
      page_count: saved.page_count,
      file_name: saved.file_name,
    });
    setSummary(saved.summary || {});
    setUnresolved(saved.unresolved || []);
    setRows(savedReviewRows(saved));
    setSavedExcluded(saved.excluded_transactions || []);
  }, [detail.data]);

  useEffect(
    () => () => {
      requestId.current++;
      controller.current?.abort();
    },
    [],
  );
  const {
    rows: statementRows,
    unmatchedRefunds,
    matchedRefunds,
    merchantRefundGroups,
  } = useMemo(() => reviewStatementRows(rows), [rows]);
  const included = useMemo(() => statementRows.filter((row) => row.included), [statementRows]);
  const invalidRows = useMemo(() => included.filter((row) => !validReviewRow(row)), [included]);
  const excluded = useMemo(
    () => statementSourceRows([
      ...savedExcluded,
      ...statementRows.filter((row) => !row.included && validReviewRow(row)),
    ]),
    [statementRows, savedExcluded],
  );
  const sourceRows = useMemo(
    () => statementSourceRows([...included.filter(validReviewRow), ...excluded]),
    [included, excluded],
  );
  const attentionRows = useMemo(
    () =>
      statementRows.filter((row) => row.amount_issue || hasUnresolvedStatementText(row.merchant)),
    [statementRows],
  );
  const extractionIssueCount = attentionRows.length + unresolved.length + emptyPages;
  const subscriptionRows = useMemo(() => statementSubscriptionRows(statementRows), [statementRows]);
  const visibleRows = statementRows.filter(
    (row) => row.kind !== "refund" && (categoryFilter === "all" || row.category === categoryFilter),
  );
  useEffect(() => {
    setPage((current) => Math.min(current, Math.max(0, Math.ceil(visibleRows.length / 30) - 1)));
  }, [visibleRows.length]);
  const summaryFees = useMemo(
    () => statementUnitemizedFees(included, summary, excluded),
    [included, summary, excluded],
  );
  const verification = useMemo(() => inspectStatementAccounting(sourceRows, summary, bank, {
    unresolvedCount: extractionIssueCount,
  }), [sourceRows, summary, bank, extractionIssueCount]);
  const differences = verification.differences;
  useEffect(() => setDifferencesReviewed(false), [rows, summary, bank, extractionIssueCount]);
  const outsideStatementPeriod = (row: ReviewTransaction) =>
    validStatementDate(row.date) &&
    /^20\d{2}-(0[1-9]|1[0-2])$/.test(period) &&
    row.date.slice(0, 7) !== period &&
    // Installment rows retain the original purchase date, even in later statements.
    // A future purchase date or a malformed installment still needs review.
    !(
      row.date.slice(0, 7) < period &&
      row.installment.includes("/") &&
      validStatementInstallment(row.installment)
    );
  const valid =
    (verification.status === "verified" || differencesReviewed) &&
    Object.values(summary).every(
      (value) =>
        Number.isFinite(value) &&
        value >= 0 &&
        value <= 100000000 &&
        Math.abs(value * 100 - Math.round(value * 100)) < 0.00001,
    ) &&
    sourceRows.length > 0 &&
    sourceRows.length <= 3000 &&
    included.every(validReviewRow);
  const archivePageCount = archive.data?.totalPages ?? 0;
  const validPeriod = /^20\d{2}-(0[1-9]|1[0-2])$/.test(period);
  const canExtract = !!file && fileCheck === "new" && !busy && !subscriptions.isPending && validPeriod;
  const canSave = !!metadata && !!bank && valid && reviewed && !busy && !viewing && validPeriod;
  const money = (amount: number, currency: string) =>
    formatCurrency(amount, currency, { locale: i18n.language.replace("_", "-") });
  const monthLabel = (value: string) => {
    const date = new Date(`${value}-15T12:00:00`);
    if (!Number.isFinite(date.getTime())) return "—";
    return new Intl.DateTimeFormat(i18n.language.replace("_", "-"), {
      month: "long",
      year: "numeric",
    }).format(date);
  };

  function clear() {
    requestId.current++;
    controller.current?.abort();
    controller.current = null;
    setRows([]);
    setDuplicateReview(null);
    setSavedExcluded([]);
    setSummary({});
    setCategoryFilter("all");
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
    setPage(0);
  }
  async function chooseFile(selected: File | null) {
    clear();
    setFile(selected);
    setFileCheck("");
    setPassword("");
    setBank("");
    setPeriod(localMonth());
    if (!selected) return;
    const operation = requestId.current;
    const aborter = new AbortController();
    controller.current = aborter;
    setFileCheck("checking");
    setBusy("check-file");
    setProgress(t("statement_checking_file"));
    try {
      const { fileHash } = await readStatementFile(selected);
      if (operation !== requestId.current || aborter.signal.aborted) return;
      const result = await statementDuplicatesService.checkFile(fileHash, aborter.signal);
      if (operation !== requestId.current || aborter.signal.aborted) return;
      setFileCheck(result.exists ? "duplicate" : "new");
      if (result.exists) setError(t("statement_duplicate"));
    } catch (err) {
      if (operation !== requestId.current || aborter.signal.aborted) return;
      setFileCheck("error");
      setError(t(err instanceof Error && err.message.startsWith("statement_")
        ? err.message : "statement_file_check_failed"));
    } finally {
      if (operation === requestId.current) {
        setBusy("");
        setProgress("");
      }
    }
  }
  function update(id: string, patch: Partial<ReviewTransaction>) {
    const pairedRefundIds = new Set(patch.included === undefined ? [] : matchedRefunds
      .filter((pair) => pair.charge.id === id).map((pair) => pair.refund.id));
    if (patch.included !== undefined) {
      for (const group of merchantRefundGroups) {
        if (group.charges.some((charge) => charge.id === id) &&
          (patch.included || group.charges.every((charge) => charge.id === id || !charge.included))) {
          for (const refund of group.refunds) pairedRefundIds.add(refund.id);
        }
      }
    }
    setRows((current) =>
      current.map((row) => {
        if (pairedRefundIds.has(row.id)) return { ...row, included: patch.included! };
        if (row.id !== id) return row;
        const next = { ...row, ...patch };
        if (patch.merchant !== undefined) {
          const match = matchSubscription(patch.merchant);
          next.category = match ? "digital" : statementCategory(patch.merchant);
          if (row.subscription_match !== "manual") {
            next.subscription_service = match?.service || "";
            next.subscription_match = match?.source;
          }
          next.uncertain = row.uncertain;
        }
        if (
          (patch.amount !== undefined && patch.amount !== row.amount) ||
          (patch.kind !== undefined && patch.kind !== "charge") ||
          (patch.currency !== undefined && patch.currency !== "TRY")
        )
          next.financing = undefined;
        if (patch.subscription_service?.trim()) {
          next.category = "digital";
          next.uncertain = false;
        }
        if (patch.category && patch.category !== "digital") {
          next.subscription_service = undefined;
          next.subscription_match = undefined;
        }
        if (patch.included === true) next.uncertain = false;
        if (patch.amount !== undefined && Number.isFinite(patch.amount)) {
          next.uncertain = false;
          next.amount_issue = undefined;
          next.amount_confirmed = true;
        }
        return next;
      }),
    );
    setReviewed(false);
    setSuccess(false);
  }
  function parse(source: StatementLine[], selectedPeriod: string, selectedBank = bank) {
    const parsed = parseStatement(source, selectedPeriod, selectedBank);
    setRows(prepareFullStatement(parsed.transactions, matchSubscription));
    // The parser returns an object even when no summary fields can be read.
    setSummary(parsed.summary);
    setCategoryFilter("all");
    setUnresolved(parsed.unresolved);
    setPage(0);
    setReviewed(false);
    setSuccess(false);
  }
  async function extract() {
    if (!canExtract) return;
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
      parse(result.lines, selectedPeriod, bank || detected.bank);
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
  async function save(approvedDuplicateKey?: string) {
    if (!canSave) return;
    setBusy("save");
    setError("");
    try {
      if (included.length) {
        let duplicates: StatementDuplicateResult;
        try {
          duplicates = await statementDuplicatesService.check({
            ...metadata,
            bank,
            period,
            transactions: included,
          });
        } catch (err) {
          throw new Error(
            err instanceof Error && err.message.startsWith("statement_")
              ? err.message
              : "statement_duplicate_check_failed",
          );
        }
        const key = JSON.stringify({ metadata, bank, period, included, duplicates });
        if (duplicates.matches.length && approvedDuplicateKey !== key) {
          setDuplicateReview({ key, result: duplicates });
          return;
        }
      }
      const saved = await api.post<{ id: string }>("/api/statements", {
        ...metadata,
        bank,
        period,
        summary,
        unresolved: [
          ...unresolved,
          ...statementRows
            .filter((row) => row.amount_issue)
            .map((row) => ({ page: row.page, text: row.source })),
        ],
        reconciliation_reviewed: differencesReviewed,
        excluded_transactions: excluded,
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
            category,
            financing,
            source,
            amount_confirmed,
          }) => ({
            id,
            date,
            merchant,
            amount,
            currency,
            kind,
            page: sourcePage,
            installment,
            ...(subscription_service?.trim()
              ? {
                  subscription_service: subscription_service.trim(),
                  subscription_match: subscription_match || "manual",
                }
              : {}),
            category,
            ...(financing ? { financing } : {}),
            ...(source ? { source } : {}),
            ...(amount_confirmed ? { amount_confirmed: true } : {}),
          }),
        ),
      });
      setViewing(saved.id);
      setDuplicateReview(null);
      setRows(included);
      setSavedExcluded(excluded);
      setLines([]);
      setFile(null);
      setSuccess(true);
      setPage(0);
      setArchivePage(1);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: archiveKey }),
        queryClient.invalidateQueries({ queryKey: queryKeys.categories.all(userId) }),
        queryClient.invalidateQueries({ queryKey: spendingKey(userId) }),
      ]);
      setImportOpen(subscriptionRows.length > 0);
    } catch (err) {
      const key = err instanceof Error && err.message.startsWith("statement_")
        ? err.message
        : "statement_save_failed";
      if (key === "statement_duplicate") setDuplicateReview(null);
      setError(t(key));
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
      await queryClient.invalidateQueries({ queryKey: spendingKey(userId) });
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
      {statementId && (
        <>
          {detail.isPending && (
            <Loader2 aria-label={t("loading")} className="h-5 w-5 animate-spin" />
          )}
          {detail.isError && (
            <p role="alert" className="text-sm text-destructive">
              {t("statement_load_failed")}
            </p>
          )}
        </>
      )}
      {!statementId && (
        <>
          <Card className="overflow-hidden rounded-3xl">
            <CardHeader className="border-b bg-muted/20">
              <CardTitle className="flex items-center gap-2 text-lg">
                <FileText className="h-5 w-5 text-primary" />
                {t("statement_upload")}
              </CardTitle>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {t("statement_intro")}
              </p>
            </CardHeader>
            <CardContent className="space-y-5 pt-6">
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
              <p className="flex items-start gap-2 rounded-xl border bg-muted/10 p-3 text-sm text-muted-foreground">
                <Lightbulb
                  className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400"
                  aria-hidden="true"
                />
                <span>{t("statement_privacy")}</span>
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
                      void chooseFile(event.target.files?.[0] ?? null);
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
                    <span
                      className="min-w-0 truncate text-sm text-muted-foreground"
                      title={file?.name}
                    >
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
                  disabled={!canExtract}
                  onClick={extract}
                >
                  {busy === "read" || busy === "check-file" ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <FileText className="mr-2 h-4 w-4" />
                  )}
                  {t("statement_read")}
                </Button>
                {(busy === "read" || busy === "check-file") && (
                  <Button className="h-11 rounded-xl" variant="outline" onClick={() => {
                    if (busy === "check-file") void chooseFile(null);
                    else clear();
                  }}>
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
              {fileCheck === "error" && file && !busy && (
                <Button variant="outline" onClick={() => void chooseFile(file)}>
                  {t("statement_file_check_retry")}
                </Button>
              )}
              {success && (
                <p role="status" className="flex items-center gap-2 text-sm text-foreground">
                  <Check className="h-4 w-4 text-primary" />
                  {t("statement_saved")}
                </p>
              )}
            </CardContent>
          </Card>
        </>
      )}
      {metadata && (
        <Card className="overflow-hidden rounded-3xl">
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 border-b bg-muted/20">
            <div className="min-w-0 space-y-1">
              <CardTitle className="text-lg">
                {statementId
                  ? `${bank ? STATEMENT_BANKS[bank] : t("statement_auto_bank")} · ${monthLabel(period)}`
                  : t(viewing ? "statement_saved_list" : "statement_review")}
              </CardTitle>
              <p className="break-all text-sm text-muted-foreground">
                {metadata.file_name} ·{" "}
                {/^20\d{2}-(0[1-9]|1[0-2])$/.test(period) ? monthLabel(period) : "—"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {viewing && !statementId && (
                <Button asChild variant="outline">
                  <StatementLink statementId={viewing}>
                    <ArrowRight className="mr-2 h-4 w-4" />
                    {t("statement_open_page")}
                  </StatementLink>
                </Button>
              )}
              {viewing && subscriptionRows.length > 0 && (
                <Button variant="outline" disabled={!!busy} onClick={() => setImportOpen(true)}>
                  <ArrowDownToLine className="mr-2 h-4 w-4" />
                  {t("statement_import_title")}
                </Button>
              )}
              {!statementId && (
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
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-5 pt-6">
            {importResult && (
              <p role="status" className="rounded-xl border bg-primary/10 p-3 text-sm">
                {t("statement_import_result", {
                  created: importResult.subscriptions_created,
                  imported: importResult.payments_imported,
                  skipped: importResult.payments_skipped,
                })}
              </p>
            )}
            {!viewing && <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">{t("statement_review_note")}</p>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                {unmatchedRefunds.length > 0 && <Button type="button" variant="outline" size="sm"
                  className="h-8 gap-1.5 border-amber-500/30 text-xs text-amber-700 dark:text-amber-300"
                  onClick={() => {
                    const section = refundsSectionRef.current;
                    if (section) {
                      section.open = true;
                      section.focus({ preventScroll: true });
                      section.scrollIntoView({ behavior: "smooth", block: "start" });
                    }
                  }}>
                  {t("statement_refunds_review_short", { count: unmatchedRefunds.length })}<ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Button>}
              </div>
            </div>}
            {!!emptyPages && (
              <p className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
                {t("statement_empty_pages", { count: emptyPages })}
              </p>
            )}
            {attentionRows.length > 0 && (
              <details open className="rounded-xl border border-amber-500/40 p-4 text-sm">
                <summary className="cursor-pointer font-semibold">
                  {t("statement_attention_title", { count: attentionRows.length })}
                </summary>
                <p className="mt-2 text-muted-foreground">{t("statement_attention_help")}</p>
                <ul className="mt-3 max-h-64 space-y-3 overflow-y-auto">
                  {attentionRows.map((row) => (
                    <li key={row.id} className="space-y-1 border-t pt-2">
                      <p className="font-medium">
                        {t("statement_page", { page: row.page })} · {row.date} · {row.merchant}
                      </p>
                      <p className="text-xs text-destructive">
                        {t(
                          row.amount_issue
                            ? `statement_amount_issue_${row.amount_issue}`
                            : "statement_text_issue",
                        )}
                      </p>
                      <p className="break-words text-xs text-muted-foreground select-text">
                        {row.source}
                      </p>
                    </li>
                  ))}
                </ul>
              </details>
            )}
            <StatementOverview
              rows={included}
              bank={bank}
              summary={summary}
              excluded={excluded}
              onSubscriptions={() => setImportOpen(true)}
              canImport={!!viewing && subscriptionRows.length > 0 && !busy}
            />
            {excluded.length > 0 && (
              <p role="status" className="text-sm text-muted-foreground">
                {t("statement_excluded_help", { count: excluded.length })}
              </p>
            )}
            {summaryFees > 0 && (
              <p role="status" className="text-sm text-muted-foreground">
                {t("statement_summary_fees_applied", { amount: money(summaryFees, "TRY") })}
              </p>
            )}
            <StatementReconciliationNotice checks={differences} inspection={verification} money={money} viewing={!!viewing}
              busy={!!busy} accepted={differencesReviewed} onAcceptedChange={setDifferencesReviewed} />
            <label className="flex items-center gap-3 text-sm">
              <span>{t("statement_category_filter")}</span>
              <ThemedSelect
                className={selectClass}
                aria-label={t("statement_category_filter")}
                value={categoryFilter}
                onChange={(event) => {
                  setCategoryFilter(event.target.value as StatementCategory | "all");
                  setPage(0);
                }}
              >
                <option value="all">{t("statement_all_categories")}</option>
                {STATEMENT_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {t(`statement_category_${category}`)}
                  </option>
                ))}
              </ThemedSelect>
            </label>
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
              <span className="text-muted-foreground">
                {t("statement_selected", {
                  selected: included.length,
                  total: statementRows.length,
                })}
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
                      setCategoryFilter("all");
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
                          category: "other",
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
            {!visibleRows.length && (
              <p className="rounded-xl border p-4 text-sm text-muted-foreground">
                {t("statement_no_rows")}
              </p>
            )}
            {visibleRows.length > 0 && (
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
                      <th className="p-3">{t("statement_category")}</th>
                      <th className="p-3">{t("statement_kind")}</th>
                      <th className="p-3">{t("statement_source")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {visibleRows.slice(page * 30, page * 30 + 30).map((row) =>
                      viewing ? (
                        <StatementSavedRow
                          key={row.id}
                          row={row}
                          outsidePeriod={outsideStatementPeriod(row)}
                          money={money}
                        />
                      ) : (
                        <tr key={row.id} className={row.included ? "" : "bg-muted/20"}>
                          {!viewing && (
                            <td className="p-3 align-top pt-5">
                              <input
                                type="checkbox"
                                className="h-4 w-4 accent-primary"
                                checked={row.included}
                                disabled={!!busy || !!row.amount_issue}
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
                                outsideStatementPeriod(row)
                                  ? "border-red-500 bg-red-500/10 text-red-700 focus-visible:ring-red-500 dark:text-red-300"
                                  : undefined
                              }
                              aria-describedby={
                                outsideStatementPeriod(row)
                                  ? `statement-date-warning-${row.id}`
                                  : undefined
                              }
                              title={
                                outsideStatementPeriod(row)
                                  ? t("statement_date_outside_period")
                                  : undefined
                              }
                              value={row.date}
                              disabled={!!viewing || !!busy}
                              onChange={(date) => update(row.id, { date })}
                            />
                            {outsideStatementPeriod(row) && (
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
                            {row.category === "digital" && (
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
                            {(row.installment || row.amount_issue || row.amount_confirmed) && (
                              <label className="mt-2 block text-xs text-muted-foreground">
                                {t("statement_installment")}
                                <Input
                                  className="mt-1 h-8"
                                  aria-label={t("statement_installment")}
                                  aria-invalid={
                                    !validStatementInstallment(row.installment) || undefined
                                  }
                                  value={row.installment}
                                  maxLength={60}
                                  disabled={!!viewing || !!busy}
                                  onChange={(event) =>
                                    update(row.id, { installment: event.target.value })
                                  }
                                />
                              </label>
                            )}
                            {!validStatementInstallment(row.installment) && (
                              <p role="alert" className="mt-1 text-xs text-destructive">
                                {t("statement_installment_invalid")}
                              </p>
                            )}
                            {row.amount_issue && (
                              <p role="alert" className="mt-2 text-xs text-destructive">
                                {t(`statement_amount_issue_${row.amount_issue}`)}
                              </p>
                            )}
                            {!viewing && row.uncertain && (
                              <span className="mt-1 block text-xs text-amber-700 dark:text-amber-400">
                                {t("statement_check_row")}
                              </span>
                            )}
                          </td>
                          <td className="p-2 align-top">
                            <Input
                              className="w-32 text-right tabular-nums"
                              type="number"
                              min="0"
                              max="100000000"
                              step="0.01"
                              aria-label={t("statement_amount")}
                              aria-invalid={!!row.amount_issue || undefined}
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
                          <td className="p-2 align-top">
                            <ThemedSelect
                              className={selectClass}
                              aria-label={t("statement_category")}
                              disabled={!!viewing || !!busy}
                              value={row.category}
                              onChange={(event) =>
                                update(row.id, {
                                  category: event.target.value as StatementCategory,
                                })
                              }
                            >
                              {STATEMENT_CATEGORIES.map((category) => (
                                <option key={category} value={category}>
                                  {t(`statement_category_${category}`)}
                                </option>
                              ))}
                            </ThemedSelect>
                          </td>
                          <td className="p-2 align-top">
                            <ThemedSelect
                              className={selectClass}
                              aria-label={t("statement_kind")}
                              value={row.kind}
                              disabled={!!viewing || !!busy}
                              onChange={(event) =>
                                update(row.id, {
                                  kind: event.target.value as ReviewTransaction["kind"],
                                })
                              }
                            >
                              {["charge", "repayment", "fee", "cash"].map((kind) => (
                                <option key={kind} value={kind}>
                                  {t(`statement_kind_${kind}`)}
                                </option>
                              ))}
                            </ThemedSelect>
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
                      ),
                    )}
                  </tbody>
                </table>
              </div>
            )}
            {visibleRows.length > 30 && (
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
                  {page + 1} / {Math.ceil(visibleRows.length / 30)}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={(page + 1) * 30 >= visibleRows.length}
                  onClick={() => setPage((current) => current + 1)}
                >
                  {t("statement_next")}
                </Button>
              </div>
            )}
            <StatementMatchedRefunds matches={matchedRefunds} groups={merchantRefundGroups} money={money} />
            {unmatchedRefunds.length > 0 && (
              <details ref={refundsSectionRef} tabIndex={-1} className="scroll-mt-4 rounded-xl border p-4 text-sm focus:outline-none">
                <summary className="cursor-pointer font-medium">
                  {t("statement_unmatched_refunds_title", { count: unmatchedRefunds.length })}
                </summary>
                <p className="mt-2 text-xs text-muted-foreground">
                  {t("statement_unmatched_refunds_help")}
                </p>
                <ul className="mt-3 divide-y">
                  {unmatchedRefunds.map((row) => (
                    <li key={row.id} className="flex items-center justify-between gap-3 py-2">
                      <label className="flex min-w-0 items-center gap-2">
                        {!viewing && (
                          <input
                            type="checkbox"
                            checked={row.included}
                            disabled={!!busy || !!row.amount_issue}
                            aria-label={t("statement_include_row", { merchant: row.merchant })}
                            onChange={(event) => update(row.id, { included: event.target.checked })}
                          />
                        )}
                        <span>
                          {row.date} · {row.merchant}
                        </span>
                      </label>
                      <span className="shrink-0 tabular-nums">
                        {viewing ? (
                          Number.isFinite(row.amount) ? (
                            `−${money(row.amount, row.currency)}`
                          ) : (
                            "—"
                          )
                        ) : (
                          <Input
                            type="number"
                            min="0"
                            max="100000000"
                            step="0.01"
                            className="w-32 text-right"
                            aria-label={t("statement_amount")}
                            aria-invalid={!!row.amount_issue || undefined}
                            disabled={!!busy}
                            value={Number.isNaN(row.amount) ? "" : row.amount}
                            onChange={(event) =>
                              update(row.id, {
                                amount:
                                  event.target.value === "" ? NaN : Number(event.target.value),
                              })
                            }
                          />
                        )}
                        {row.amount_issue && (
                          <span
                            role="alert"
                            className="mt-1 block max-w-64 whitespace-normal text-xs text-destructive"
                          >
                            {t(`statement_amount_issue_${row.amount_issue}`)}
                          </span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
            {unresolved.length > 0 && (
              <details open className="rounded-xl border border-amber-500/40 p-4 text-sm">
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
                    aria-label={t("statement_review_confirm")}
                    aria-describedby={
                      extractionIssueCount ? "statement-extraction-review-warning" : undefined
                    }
                    className="mt-1 h-4 w-4 shrink-0 accent-primary"
                    checked={reviewed}
                    disabled={!!busy}
                    onChange={(event) => setReviewed(event.target.checked)}
                  />
                  <span id="statement-extraction-review-warning">
                    {t(
                      extractionIssueCount
                        ? "statement_review_confirm_incomplete"
                        : "statement_review_confirm",
                      { count: extractionIssueCount },
                    )}
                  </span>
                </label>
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    className="disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none"
                    disabled={!canSave}
                    onClick={() => void save()}
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
                {invalidRows.length > 0 && (
                  <div role="alert" className="space-y-2 text-sm text-destructive">
                    <p>{t("statement_invalid_rows")}</p>
                    <ul className="space-y-1">
                      {invalidRows.map((row) => (
                        <li key={row.id}>
                          <span className="font-medium">{row.merchant || row.date}</span>
                          {" · "}{t("statement_page", { page: row.page })}
                          {" · "}{invalidReviewFields(row).map((field) => t(field)).join(", ")}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {!statementId && (
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
                  <StatementLink
                    statementId={saved.id}
                    className="min-w-0 flex-1 rounded-lg text-left focus-visible:outline focus-visible:outline-ring"
                  >
                    <span className="block font-medium">
                      {saved.bank ? STATEMENT_BANKS[saved.bank] : t("statement_auto_bank")} ·{" "}
                      {monthLabel(saved.period)}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {saved.file_name}
                    </span>
                  </StatementLink>
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
            {archivePageCount > 1 && (
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
                  {archivePage} / {archivePageCount}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={archivePage >= archivePageCount}
                  onClick={() => setArchivePage((current) => current + 1)}
                >
                  {t("statement_next")}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
      {importOpen && viewing && (
        <Suspense fallback={<PageLoading />}>
          <StatementImportDialog
            statementId={viewing}
            userId={userId}
            rows={subscriptionRows}
            onClose={() => setImportOpen(false)}
            onImported={setImportResult}
          />
        </Suspense>
      )}
      <StatementDuplicateDialog
        result={duplicateReview?.result || null}
        busy={!!busy}
        error={error}
        onCancel={() => setDuplicateReview(null)}
        onConfirm={() => void save(duplicateReview?.key)}
      />
      <ConfirmDialog
        confirmOnEnter
        open={!!deleteId}
        onOpenChange={dialogDismissHandler(() => setDeleteId(null))}
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
