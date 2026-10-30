import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Eye, EyeOff, Lightbulb, Pencil, Wallet } from "lucide-react";
import { type MouseEvent, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { FinanceSalaryCharts } from "@/components/FinanceSalaryCharts";
import { FinanceSalaryStatus } from "@/components/FinanceSalaryStatus";
import { FinanceSalaryTag } from "@/components/FinanceSalaryTag";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { dialogDismissHandler } from "@/lib/dialogDismiss";
import {
  type FinanceData,
  financeRowsForYear,
  percentChange,
  SALARY_TAGS,
  salaryAnalysis,
  type SalaryTag,
} from "@/lib/finance";
import { resolveLocale } from "@/lib/locale";
import { SALARY_TAG_STYLES } from "@/lib/salaryTagStyles";
import { cn, formatCurrency, formatMultiplier } from "@/lib/utils";
import { financeService } from "@/services/finance";

export function FinanceSalaryComparison({
  data,
  ownerId,
  year: selectedYear,
  today,
  decimalPlaces,
  loadingReferences,
  referenceError,
  onYearChange,
  onOpenLedger,
  onFetchReferences,
  onEditReference,
}: {
  data: FinanceData;
  ownerId: string;
  year: number;
  today: string;
  decimalPlaces: number;
  loadingReferences: boolean;
  referenceError: boolean;
  onYearChange: (year: number) => void;
  onOpenLedger: () => void;
  onFetchReferences: (years: number[]) => void;
  onEditReference: (month: number, year: number, field?: "usd" | "eur" | "minimum") => void;
}) {
  const { t, i18n } = useTranslation();
  const currentYear = Number(today.slice(0, 4));
  const year = Math.min(selectedYear, currentYear);
  const automaticRequests = useRef(new Set<string>());
  const [allYears, setAllYears] = useState(false);
  const [comparisonVisibility, setComparisonVisibility] = useState({
    salary: true,
    salary_usd_value: false,
    salary_eur_value: false,
    salary_minimum_multiple: false,
  });
  const queryClient = useQueryClient();
  const [tagContext, setTagContext] = useState<{
    month: string;
    x: number;
    y: number;
    referenceField?: "usd" | "eur" | "minimum";
  } | null>(null);
  const tagMutation = useMutation({
    mutationFn: ({ month, tag }: { month: string; tag: SalaryTag | ""; ownerId: string }) =>
      financeService.setSalaryTag(month, tag),
    onSuccess: async (_result, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["finance", variables.ownerId] });
      toast.success(t("finance_success"));
    },
    onError: () => toast.error(t("finance_salary_tag_failed")),
  });
  const openSalaryTags = (
    month: string,
    event: MouseEvent<HTMLElement>,
    referenceField?: "usd" | "eur" | "minimum",
  ) => {
    event.preventDefault();
    if (!ownerId || (!referenceField && tagMutation.isPending)) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    setTagContext({
      month,
      x: event.clientX || bounds.left,
      y: event.clientY || bounds.bottom,
      referenceField,
    });
  };
  const label = (key: string) => t(`finance_${key}`);
  const locale = resolveLocale(i18n, "tr");
  const currency = (amount: number, code = "TRY") =>
    formatCurrency(amount, code, {
      locale,
      minimumFractionDigits: decimalPlaces,
      maximumFractionDigits: decimalPlaces,
    });
  const percent = (amount: number | null) =>
    amount == null
      ? "—"
      : new Intl.NumberFormat(locale, {
          style: "percent",
          maximumFractionDigits: 1,
          signDisplay: "exceptZero",
        }).format(amount / 100);
  const monthName = (month: string) =>
    new Intl.DateTimeFormat(locale, { month: "long", timeZone: "UTC" }).format(
      new Date(`${month}-01T12:00:00Z`),
    );
  const analyses = salaryAnalysis(data, year);
  const salaryRows = financeRowsForYear(data.finance_rows, year, data).filter(
    (row) => row.kind === "salary",
  );
  const salaryIds = new Set(
    data.finance_rows
      .filter((row) => row.kind === "salary" && !row.is_deleted)
      .map((row) => row.id),
  );
  const candidateYears = [
    ...new Set(
      data.finance_entries
        .filter((entry) => salaryIds.has(entry.row_id))
        .map((entry) => Number(entry.date.slice(0, 4))),
    ),
  ];
  const availableYears = candidateYears
    .filter(
      (value) =>
        value <= currentYear && salaryAnalysis(data, value).some((month) => month.salary != null),
    )
    .sort((a, b) => a - b);
  const recorded = (
    allYears
      ? availableYears.flatMap((value) => (value === year ? analyses : salaryAnalysis(data, value)))
      : analyses
  ).filter((month) => month.salary != null);
  const recordedByMonth = new Map(recorded.map((month) => [month.month, month]));
  const summaryMonths =
    allYears || year === currentYear
      ? recorded.filter((month) => month.month <= today.slice(0, 7))
      : recorded;
  const first = summaryMonths[0];
  const last = summaryMonths[summaryMonths.length - 1];
  const change = first && last ? percentChange(last.salary, first.salary) : null;
  const publishedMonths = recorded.filter((month) => month.month <= today.slice(0, 7));
  const isMissingReference = (month: (typeof recorded)[number]) =>
    !month.reference?.usd || !month.reference?.eur || !month.reference?.minimum_wage;
  const missingReferences = publishedMonths.filter(isMissingReference).length;
  const futureReferences = recorded.filter(
    (month) => month.month > today.slice(0, 7) && isMissingReference(month),
  ).length;
  const neededYears = [
    ...new Set(
      publishedMonths
        .filter(
          (month) =>
            isMissingReference(month) ||
            (month.month === today.slice(0, 7) && !month.reference?.updated_at?.startsWith(today)),
        )
        .map((month) => Number(month.month.slice(0, 4))),
    ),
  ];
  // A primitive dependency stays stable when unrelated UI state rerenders.
  const neededYearsKey = neededYears.join(",");
  const requestKey = `${ownerId}:${allYears ? "all" : year}:${today}:${publishedMonths.map((month) => month.month).join(",")}`;
  useEffect(() => {
    if (
      !ownerId ||
      loadingReferences ||
      !neededYearsKey ||
      automaticRequests.current.has(requestKey)
    )
      return;
    // Mark before starting: StrictMode and partial failures must not create a loop.
    automaticRequests.current.add(requestKey);
    onFetchReferences(neededYearsKey.split(",").map(Number));
  }, [ownerId, loadingReferences, neededYearsKey, requestKey, onFetchReferences]);
  const noComparison = (
    <span className="text-xs text-muted-foreground">{label("salary_no_comparison_data")}</span>
  );
  const comparisonRows = [
    "salary",
    "salary_usd_value",
    "salary_eur_value",
    "salary_minimum_multiple",
  ] as const;
  const visibleComparisonRows = comparisonRows.filter((field) => comparisonVisibility[field]);
  const compactAllYears = allYears && visibleComparisonRows.length === comparisonRows.length;
  const referenceFieldFor = (
    field: (typeof comparisonRows)[number],
  ): "usd" | "eur" | "minimum" | undefined =>
    field === "salary_usd_value"
      ? "usd"
      : field === "salary_eur_value"
        ? "eur"
        : field === "salary_minimum_multiple"
          ? "minimum"
          : undefined;
  const comparisonValue = (
    field: (typeof comparisonRows)[number],
    row: (typeof recorded)[number],
  ) => {
    const taggedValue = (value: string) => (
      <span
        className={cn(
          row.reference?.salary_tag ? "text-sm font-bold" : "text-[#bfbfbf]",
          row.reference?.salary_tag && SALARY_TAG_STYLES[row.reference.salary_tag].text,
        )}
        style={
          visibleComparisonRows.length === 1
            ? {
                fontSize: row.reference?.salary_tag
                  ? "calc(0.875rem + 2px)"
                  : "calc(0.75rem + 2px)",
              }
            : undefined
        }
      >
        {value}
      </span>
    );
    switch (field) {
      case "salary":
        return (
          <>
            {taggedValue(currency(row.salary!))}
            {row.status !== "settled" && <FinanceSalaryStatus status={row.status} />}
          </>
        );
      case "salary_usd_value":
        return row.usd == null ? noComparison : taggedValue(currency(row.usd, "USD"));
      case "salary_eur_value":
        return row.eur == null ? noComparison : taggedValue(currency(row.eur, "EUR"));
      case "salary_minimum_multiple":
        return row.minimum == null ? noComparison : taggedValue(formatMultiplier(row.minimum));
    }
  };
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="flex items-start gap-2 text-sm leading-relaxed text-muted-foreground">
          <Lightbulb
            className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400"
            aria-hidden="true"
          />
          {label("salary_source_help")}
        </p>
        {salaryRows.length > 1 && (
          <p className="text-xs text-muted-foreground">
            {t("finance_salary_combined_sources", {
              names: salaryRows.map((row) => row.name).join(" + "),
            })}
          </p>
        )}
      </div>
      {!availableYears.length ? (
        <section className="space-y-4 rounded-2xl border border-dashed bg-card/30 p-6 sm:p-8">
          <Wallet className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
          <div className="space-y-2">
            <h3 className="font-semibold">{t("finance_salary_empty_year", { year })}</h3>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {label("salary_empty_help")}
            </p>
          </div>
          <Button type="button" variant="outline" onClick={onOpenLedger}>
            {label("salary_open_ledger")}
          </Button>
        </section>
      ) : (
        <>
          <section className="overflow-hidden rounded-2xl border bg-card/30">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <h3 className="font-semibold">{label("salary_monthly_comparison")}</h3>
                  <div className="text-xs" role="status">
                    {loadingReferences ? (
                      <p className="text-muted-foreground">{label("rates_loading")}</p>
                    ) : referenceError ? (
                      <p className="text-destructive">{label("rates_error")}</p>
                    ) : missingReferences > 0 ? (
                      <p className="text-muted-foreground">
                        {t("finance_salary_missing_references", { count: missingReferences })}
                      </p>
                    ) : publishedMonths.length > 0 ? (
                      <p className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
                        <Check className="h-3.5 w-3.5" aria-hidden="true" />
                        {label("salary_references_ready")}
                      </p>
                    ) : null}
                  </div>
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {label("salary_reference_help_short")}
                  {!loadingReferences &&
                    (futureReferences > 0 || (recorded.length > 0 && !publishedMonths.length)) && (
                      <> {label("salary_future_references")}</>
                    )}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-4">
                {!allYears && (
                  <div
                    className="space-y-0.5 border-r pr-4 text-right"
                    title={label("salary_change_help")}
                  >
                    <p className="text-xs text-muted-foreground">
                      {t("finance_salary_year_change", { year })}
                    </p>
                    <p
                      className={cn(
                        "text-xl font-semibold tabular-nums",
                        change != null && change > 0 && "text-emerald-700 dark:text-emerald-400",
                        change != null && change < 0 && "text-rose-700 dark:text-rose-400",
                      )}
                    >
                      {percent(change)}
                    </p>
                  </div>
                )}
                <div
                  className="flex gap-1 rounded-xl border bg-muted/20 p-1"
                  role="group"
                  aria-label={label("salary_chart_period")}
                >
                  <Button
                    type="button"
                    size="sm"
                    variant={!allYears ? "default" : "ghost"}
                    aria-pressed={!allYears}
                    onClick={() => setAllYears(false)}
                  >
                    {year}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={allYears ? "default" : "ghost"}
                    aria-pressed={allYears}
                    onClick={() => setAllYears(true)}
                  >
                    {label("salary_chart_all_years")}
                  </Button>
                </div>
              </div>
            </div>
            <div
              className="flex flex-wrap gap-2 border-b px-4 py-3"
              role="group"
              aria-label={label("salary_visible_columns")}
            >
              {comparisonRows.map((field) => {
                const visible = comparisonVisibility[field];
                const Icon = visible ? Eye : EyeOff;
                return (
                  <Button
                    key={field}
                    type="button"
                    variant="outline"
                    size="sm"
                    aria-pressed={visible}
                    disabled={visible && visibleComparisonRows.length === 1}
                    aria-label={t(
                      visible ? "finance_salary_hide_column" : "finance_salary_show_column",
                      { name: label(field) },
                    )}
                    className={cn(
                      "gap-2 text-xs",
                      visible ? "border-primary/40 bg-primary/10" : "text-muted-foreground",
                    )}
                    onClick={() =>
                      setComparisonVisibility((current) => ({
                        ...current,
                        [field]: !current[field],
                      }))
                    }
                  >
                    <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                    {label(field)}
                  </Button>
                );
              })}
            </div>
            {!recorded.length ? (
              <p className="p-6 text-sm text-muted-foreground">
                {t("finance_salary_empty_year", { year })}
              </p>
            ) : allYears ? (
              <div className="overflow-x-auto">
                <table
                  className={cn(
                    "whitespace-nowrap text-xs tabular-nums",
                    compactAllYears ? "w-max" : "w-full",
                  )}
                >
                  <caption className="sr-only">
                    {label("salary_chart_all_years")} · {label("salary_monthly_comparison")}
                  </caption>
                  <thead className="border-b bg-muted/20 text-muted-foreground">
                    <tr>
                      <th
                        scope="col"
                        rowSpan={2}
                        className="sticky left-0 z-20 w-px border-r bg-card px-2 py-2 text-left font-medium"
                      >
                        {label("month")}
                      </th>
                      {availableYears.map((value) => (
                        <th
                          key={value}
                          scope="colgroup"
                          colSpan={visibleComparisonRows.length}
                          className="border-r border-border/50 px-3 py-2 text-center font-semibold last:border-r-0"
                        >
                          <button
                            type="button"
                            className="rounded px-3 py-1 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                            onClick={() => {
                              onYearChange(value);
                              setAllYears(false);
                            }}
                          >
                            {value}
                          </button>
                        </th>
                      ))}
                    </tr>
                    <tr className="border-t border-border/50">
                      {availableYears.flatMap((value) =>
                        visibleComparisonRows.map((field) => (
                          <th
                            key={`${value}-${field}`}
                            scope="col"
                            className={cn(
                              "border-r border-border/50 py-2 text-right font-medium last:border-r-0",
                              compactAllYears
                                ? "w-px px-1"
                                : field === "salary_minimum_multiple"
                                  ? "w-16 px-1"
                                  : "px-3",
                              field === "salary_minimum_multiple" && "text-center",
                            )}
                          >
                            {field === "salary_minimum_multiple" ? (
                              <span
                                className={cn(
                                  "inline-block whitespace-normal break-words text-center leading-tight",
                                  compactAllYears ? "w-10" : "w-14",
                                )}
                              >
                                {label(field)}
                              </span>
                            ) : (
                              <span
                                className={cn(
                                  "inline-block max-w-full whitespace-normal break-words leading-tight",
                                  compactAllYears ? "w-12" : "w-16",
                                )}
                              >
                                {label(field)}
                              </span>
                            )}
                          </th>
                        )),
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: 12 }, (_, index) => (
                      <tr
                        key={index}
                        className="border-b border-border/60 last:border-b-0 hover:bg-muted/10"
                      >
                        <th
                          scope="row"
                          className="sticky left-0 z-10 w-px border-r bg-card px-2 py-2 text-left font-medium"
                        >
                          {monthName(`${year}-${String(index + 1).padStart(2, "0")}`)}
                        </th>
                        {availableYears.flatMap((value) => {
                          const month = recordedByMonth.get(
                            `${value}-${String(index + 1).padStart(2, "0")}`,
                          );
                          return visibleComparisonRows.map((field) => (
                            <td
                              key={`${value}-${field}`}
                              className={cn(
                                "border-r border-border/50 py-2 text-right last:border-r-0",
                                field === "salary" && "relative font-semibold",
                                compactAllYears
                                  ? "w-px px-1"
                                  : field === "salary_minimum_multiple"
                                    ? "w-16 px-1"
                                    : "px-3",
                                field === "salary_minimum_multiple" && "text-center",
                              )}
                              tabIndex={month && referenceFieldFor(field) ? 0 : undefined}
                              onContextMenu={
                                month
                                  ? (event) =>
                                      openSalaryTags(month.month, event, referenceFieldFor(field))
                                  : undefined
                              }
                            >
                              {!month ? (
                                <span className="text-muted-foreground">—</span>
                              ) : field === "salary" ? (
                                <span
                                  className={cn(
                                    "inline-flex items-center",
                                    compactAllYears ? "gap-1" : "gap-1.5",
                                  )}
                                >
                                  {month.reference?.salary_tag && (
                                    <button
                                      type="button"
                                      onClick={(event) => openSalaryTags(month.month, event)}
                                      aria-label={`${monthName(month.month)} ${value} · ${label("salary_tag_menu")}`}
                                    >
                                      <FinanceSalaryTag tag={month.reference.salary_tag} />
                                    </button>
                                  )}
                                  {comparisonValue(field, month)}
                                </span>
                              ) : (
                                comparisonValue(field, month)
                              )}
                            </td>
                          ));
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full whitespace-nowrap text-xs tabular-nums">
                  <caption className="sr-only">
                    {year} · {label("salary_monthly_comparison")}
                  </caption>
                  <thead className="border-b bg-muted/20 text-xs text-muted-foreground">
                    <tr>
                      <th
                        scope="col"
                        className="sticky left-0 z-20 w-40 border-r bg-card px-3 py-2 text-left font-medium"
                      >
                        {year}
                      </th>
                      {recorded.map((month) => (
                        <th
                          key={month.month}
                          scope="col"
                          className="border-r border-border/50 px-1.5 py-2 text-right font-medium last:border-r-0"
                          onContextMenu={(event) => openSalaryTags(month.month, event)}
                        >
                          <button
                            type="button"
                            className="inline-flex items-center justify-end gap-1 rounded px-1 py-0.5 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                            aria-label={`${monthName(month.month)} ${month.month.slice(0, 4)} · ${label("salary_tag_menu")}${month.reference?.salary_tag ? ` · ${label(`salary_tag_${month.reference.salary_tag}`)}` : ""}`}
                            onClick={(event) => openSalaryTags(month.month, event)}
                          >
                            <span title={label("salary_tag_hint")}>{monthName(month.month)}</span>
                            {month.reference?.salary_tag && (
                              <FinanceSalaryTag tag={month.reference.salary_tag} />
                            )}
                          </button>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {visibleComparisonRows.map((field) => (
                      <tr
                        key={field}
                        className="border-b border-border/60 last:border-b-0 hover:bg-muted/10"
                      >
                        <th
                          scope="row"
                          className="sticky left-0 z-10 w-40 whitespace-normal border-r bg-card px-3 py-2 text-left font-medium"
                        >
                          {label(field)}
                        </th>
                        {recorded.map((month) => (
                          <td
                            key={month.month}
                            className={cn(
                              "border-r border-border/50 px-1.5 py-2 text-right last:border-r-0",
                              field === "salary" && "relative font-semibold",
                            )}
                            tabIndex={referenceFieldFor(field) ? 0 : undefined}
                            onContextMenu={(event) =>
                              openSalaryTags(month.month, event, referenceFieldFor(field))
                            }
                          >
                            {comparisonValue(field, month)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
      <FinanceSalaryCharts
        data={data}
        year={year}
        years={availableYears}
        today={today}
        decimalPlaces={decimalPlaces}
      />
      {tagContext && (
        <DropdownMenu open onOpenChange={dialogDismissHandler(() => setTagContext(null))}>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-hidden
              tabIndex={-1}
              style={{
                position: "fixed",
                left: tagContext.x,
                top: tagContext.y,
                width: 1,
                height: 1,
                pointerEvents: "none",
              }}
            />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            sideOffset={0}
            onCloseAutoFocus={(event) => event.preventDefault()}
          >
            <DropdownMenuLabel>
              {monthName(tagContext.month)} {tagContext.month.slice(0, 4)} ·{" "}
              {label(tagContext.referenceField || "salary_tag_menu")}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {tagContext.referenceField ? (
              <DropdownMenuItem
                disabled={loadingReferences}
                onSelect={() =>
                  onEditReference(
                    Number(tagContext.month.slice(5)),
                    Number(tagContext.month.slice(0, 4)),
                    tagContext.referenceField,
                  )
                }
              >
                <Pencil className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
                {label(tagContext.referenceField === "minimum" ? "edit_minimum_wage" : "edit_rate")}
              </DropdownMenuItem>
            ) : (
              (["", ...SALARY_TAGS] as const).map((tag) => (
                <DropdownMenuItem
                  key={tag || "none"}
                  disabled={tagMutation.isPending}
                  onSelect={() => tagMutation.mutate({ month: tagContext.month, tag, ownerId })}
                >
                  {tag && <FinanceSalaryTag tag={tag} />}
                  <span>{label(tag ? `salary_tag_${tag}` : "bill_none")}</span>
                  {(data.finance_benchmarks.find((item) => item.month === tagContext.month)
                    ?.salary_tag || "") === tag && (
                    <Check className="ml-auto h-4 w-4" aria-hidden="true" />
                  )}
                </DropdownMenuItem>
              ))
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
