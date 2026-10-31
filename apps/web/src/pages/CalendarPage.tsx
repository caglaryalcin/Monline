import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { CalendarClearPaymentsDialog } from "@/components/calendar/CalendarClearPaymentsDialog";
import { CalendarMonthCard } from "@/components/calendar/CalendarMonthCard";
import { CalendarMoveDialog } from "@/components/calendar/CalendarMoveDialog";
import { CalendarOverview } from "@/components/calendar/CalendarOverview";
import { CalendarPageHeader } from "@/components/calendar/CalendarPageHeader";
import { matchesCalendarSearch } from "@/components/calendar/calendarSearch";
import { DayPanel } from "@/components/calendar/DayPanel";
import { HistoricalPaymentDialog } from "@/components/calendar/HistoricalPaymentDialog";
import { MarkAsPaidModal } from "@/components/calendar/MarkAsPaidModal";
import { SpendingDetailDialog } from "@/components/calendar/SpendingDetailDialog";
import { SubDetailDialog } from "@/components/calendar/SubDetailDialog";
import {
  type DayEntry,
  getPaymentRecord,
  parseLocalDate,
  toDateStr,
} from "@/components/calendar/types";
import { UndatedStatementFees } from "@/components/calendar/UndatedStatementFees";
import { useCalendarMonthData } from "@/components/calendar/useCalendarMonthData";
import { ScopedTransferActions } from "@/components/ScopedTransferActions";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { dialogDismissHandler } from "@/lib/dialogDismiss";
import { queryKeys } from "@/lib/queryKeys";
import { EMPTY_SPENDING, spendingKey } from "@/lib/spending";
import { toast } from "@/lib/toast";
import { categoriesService } from "@/services/categories";
import { currenciesService } from "@/services/currencies";
import { cyclesService } from "@/services/cycles";
import { householdService } from "@/services/household";
import { paymentMethodsService } from "@/services/paymentMethods";
import { paymentRecordsService } from "@/services/paymentRecords";
import { spendingService } from "@/services/spending";
import { subscriptionsService } from "@/services/subscriptions";
import type { PaymentRecord } from "@/types";

export function CalendarPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const queryClient = useQueryClient();

  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const selectedDay =
    selectedDate?.getFullYear() === year && selectedDate.getMonth() + 1 === month
      ? selectedDate.getDate()
      : null;
  const setSelectedDay = (day: number | null) =>
    setSelectedDate(day === null ? null : new Date(year, month - 1, day));
  const [detailEntry, setDetailEntry] = useState<DayEntry | null>(null);
  const [moveEntry, setMoveEntry] = useState<DayEntry | null>(null);
  const [historicalOpen, setHistoricalOpen] = useState(false);
  const [paymentMode, setPaymentMode] = useState<"confirm" | "edit">("confirm");
  const [markAsPaidEntry, setMarkAsPaidEntry] = useState<DayEntry | null>(null);
  const [deletePayment, setDeletePayment] = useState<PaymentRecord | null>(null);
  const [clearOpen, setClearOpen] = useState(false);
  const clearCalendar = useMutation({
    mutationFn: () => paymentRecordsService.clearCalendar("payments"),
    onSuccess: async () => {
      setClearOpen(false);
      setSelectedDate(null);
      setDetailEntry(null);
      setMarkAsPaidEntry(null);
      setHistoricalOpen(false);
      setDeletePayment(null);
      await queryClient.invalidateQueries();
      toast.success(t("calendar_cleared"));
    },
    onError: () => toast.error(t("calendar_delete_failed")),
  });
  const removePayment = useMutation({
    mutationFn: (record: PaymentRecord) => paymentRecordsService.remove(record.id),
    onSuccess: async () => {
      setDeletePayment(null);
      setDetailEntry(null);
      setMarkAsPaidEntry(null);
      await queryClient.invalidateQueries();
      toast.success(t("calendar_payment_deleted"));
    },
    onError: () => toast.error(t("calendar_delete_failed")),
  });

  const paymentTracking = !!user?.payment_tracking;
  const movePayment = useMutation({
    mutationFn: ({ entry, date, mode }: { entry: DayEntry; date: Date; mode?: "ledger" }) => {
      const record = getPaymentRecord(paymentRecords, entry.sub.id, toDateStr(entry.date));
      return paymentRecordsService.move({
        ...(entry.spending
          ? { source: entry.spending.source, source_id: entry.spending.id }
          : record
            ? { payment_id: record.id }
            : { subscription_id: entry.sub.id }),
        from_date: toDateStr(entry.date),
        to_date: toDateStr(date),
        ...(mode === "ledger"
          ? {
              mode,
              expected_source_date: entry.spending?.date,
              expected_amount: entry.spending?.amount,
            }
          : {}),
      });
    },
    onSuccess: async (result) => {
      setSelectedDate(null);
      setDetailEntry(null);
      setMoveEntry(null);
      await queryClient.invalidateQueries();
      toast.success(
        t(result.ledger_updated ? "calendar_payment_ledger_moved" : "calendar_payment_moved"),
      );
    },
    onError: (error: unknown) => {
      const code = error instanceof Error ? error.message : undefined;
      toast.error(
        t(
          code &&
            ["calendar_move_conflict", "calendar_move_changed", "calendar_move_invalid"].includes(
              code,
            )
            ? code
            : "calendar_move_failed",
        ),
      );
      void queryClient.invalidateQueries();
    },
  });
  const spending = useQuery({
    queryKey: spendingKey(userId),
    queryFn: spendingService.get,
    enabled: !!userId,
    staleTime: 30_000,
  });
  const spendingData = spending.data ?? EMPTY_SPENDING;

  const markUnpaid = useMutation({
    mutationFn: (record: PaymentRecord) => paymentRecordsService.markUnpaid(record.id),
    onSuccess: async () => {
      await queryClient.invalidateQueries();
      toast.success(t("marked_as_unpaid"));
    },
    onError: () => toast.error(t("mark_as_unpaid_failed")),
  });

  const paymentMutationsBusy =
    movePayment.isPending ||
    clearCalendar.isPending ||
    removePayment.isPending ||
    markUnpaid.isPending;
  const requestPaymentMove = (entry: DayEntry, date: Date | string, mode?: "ledger") => {
    const parsed = typeof date === "string" ? parseLocalDate(date) : date;
    if (parsed && !paymentMutationsBusy) movePayment.mutate({ entry, date: parsed, mode });
  };
  const {
    data: subscriptions = [],
    isLoading: loadingSubscriptions,
    isError: subscriptionsError,
  } = useQuery({
    queryKey: queryKeys.subscriptions.all(userId),
    queryFn: () => subscriptionsService.list(userId),
    refetchOnWindowFocus: "always",
    enabled: !!userId,
  });

  const { data: cycles = [] } = useQuery({
    queryKey: queryKeys.cycles(),
    queryFn: () => cyclesService.list(),
  });

  const {
    data: currencies = [],
    isLoading: loadingCurrencies,
    isError: currenciesError,
  } = useQuery({
    queryKey: queryKeys.currencies.all(userId),
    queryFn: () => currenciesService.list(userId),
    enabled: !!userId,
  });

  const { data: categories = [], isPending: categoriesPending } = useQuery({
    queryKey: queryKeys.categories.all(userId),
    queryFn: () => categoriesService.list(userId),
    enabled: !!userId && historicalOpen,
  });

  const { data: paymentMethods = [], isPending: paymentMethodsPending } = useQuery({
    queryKey: queryKeys.paymentMethods.all(userId),
    queryFn: () => paymentMethodsService.list(userId),
    enabled: !!userId && historicalOpen,
  });

  const { data: household = [], isPending: householdPending } = useQuery({
    queryKey: queryKeys.household.all(userId),
    queryFn: () => householdService.list(userId),
    staleTime: 30_000,
    refetchOnWindowFocus: "always",
    enabled: !!userId && historicalOpen,
  });

  const {
    data: paymentRecords = [],
    isLoading: loadingPayments,
    isError: paymentsError,
  } = useQuery({
    queryKey: queryKeys.paymentRecords.all(userId),
    queryFn: () => paymentRecordsService.listForUser(userId),
    refetchOnWindowFocus: "always",
    enabled: !!userId,
  });

  const calendarPaymentCount = paymentRecords.length;
  const historicalDataPending = categoriesPending || paymentMethodsPending || householdPending;
  const hasCalendarEntries =
    calendarPaymentCount > 0 || subscriptions.some((sub) => !sub.calendar_projection_hidden);

  const { allCells, currencyById, daysInMonth, entriesByDay, entriesByDate, mainCurrency, stats, selectedEntries, selectedDayTotal } =
    useCalendarMonthData({
      subscriptions,
      cycles,
      currencies,
      year,
      month,
      selectedDay,
      paymentRecords,
      spendingEvents: spendingData.events,
      calendarMoves: spendingData.calendar_moves,
      includeAdjacentDays: true,
      searchTerm,
    });

  const selectionOutsideMonth = selectedDate !== null &&
    (selectedDate.getFullYear() !== year || selectedDate.getMonth() + 1 !== month);
  const selectedMonth = useCalendarMonthData({
    enabled: selectionOutsideMonth,
    subscriptions,
    cycles,
    currencies,
    paymentRecords,
    year: selectedDate?.getFullYear() ?? year,
    month: selectedDate ? selectedDate.getMonth() + 1 : month,
    selectedDay: selectedDate?.getDate() ?? null,
    spendingEvents: spendingData.events,
    calendarMoves: spendingData.calendar_moves,
    searchTerm,
  });

  const undatedFees = spendingData.events.filter(
    (event) =>
      event.undated &&
      event.statement_period === `${year}-${String(month).padStart(2, "0")}` &&
      matchesCalendarSearch(event.name, searchTerm),
  );

  const budget = user?.budget ?? 0;
  const budgetOverrun = budget > 0 ? Math.max(0, stats.total - budget) : 0;

  const isCurrentMonth = month === now.getMonth() + 1 && year === now.getFullYear();

  const goToday = () => {
    setMonth(now.getMonth() + 1);
    setYear(now.getFullYear());
    setSelectedDay(null);
  };

  const goToPreviousMonth = () => {
    setSelectedDay(null);

    if (month === 1) {
      setMonth(12);
      setYear((current) => current - 1);
      return;
    }

    setMonth((current) => current - 1);
  };

  const goToNextMonth = () => {
    setSelectedDay(null);

    if (month === 12) {
      setMonth(1);
      setYear((current) => current + 1);
      return;
    }

    setMonth((current) => current + 1);
  };

  return (
    <div className="monline-calendar-page flex min-h-0 flex-col gap-4">
      <CalendarPageHeader
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        transferActions={<ScopedTransferActions scope="calendar" compact />}
        onAddHistorical={!loadingSubscriptions ? () => setHistoricalOpen(true) : undefined}
        onClearAll={() => setClearOpen(true)}
        clearDisabled={
          loadingSubscriptions ||
          loadingPayments ||
          clearCalendar.isPending ||
          removePayment.isPending ||
          markUnpaid.isPending ||
          movePayment.isPending ||
          !hasCalendarEntries
        }
      />

      {historicalOpen && historicalDataPending && (
        <Dialog open onOpenChange={dialogDismissHandler(() => setHistoricalOpen(false))}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("historical_add")}</DialogTitle>
              <DialogDescription>{t("loading")}</DialogDescription>
            </DialogHeader>
          </DialogContent>
        </Dialog>
      )}
      {historicalOpen && !historicalDataPending && (
        <HistoricalPaymentDialog
          subscriptions={subscriptions}
          currencies={currencies}
          categories={categories}
          paymentMethods={paymentMethods}
          household={household}
          records={paymentRecords}
          userId={userId}
          initialDate={selectedDate ? toDateStr(selectedDate) : undefined}
          onClose={() => setHistoricalOpen(false)}
          onSaved={(record) => {
            setHistoricalOpen(false);
            setSelectedDate(parseLocalDate(record.due_date));
          }}
        />
      )}

      <CalendarOverview
        count={stats.count}
        total={stats.total}
        due={stats.due}
        awaitingConfirmation={stats.awaitingConfirmation}
        loading={loadingSubscriptions || loadingCurrencies || loadingPayments || spending.isLoading}
        hasError={subscriptionsError || currenciesError || paymentsError || spending.isError}
        mainCurrency={mainCurrency}
        budgetOverrun={budgetOverrun}
      />
      {spending.isError && (
        <p role="alert" className="text-sm text-destructive">
          {t("spending_load_failed")}
        </p>
      )}
      {spendingData.issues.length > 0 && (
        <p role="alert" className="text-sm text-amber-700 dark:text-amber-400">
          {t("spending_source_issues", { count: spendingData.issues.length })}
        </p>
      )}
      {Object.values(entriesByDay)
        .flat()
        .some(
          (entry) =>
            entry.spending &&
            !entry.sub.expand?.currency?.is_main &&
            !entry.sub.expand?.currency?.rate,
        ) && (
        <p role="status" className="text-sm text-muted-foreground">
          {t("spending_missing_rates")}
        </p>
      )}

      {searchTerm.trim() &&
        !loadingSubscriptions &&
        !spending.isLoading &&
        !subscriptionsError &&
        !spending.isError &&
        !Object.values(entriesByDate).some((entries) => entries.length > 0) &&
        !undatedFees.length && (
          <p role="status" className="text-sm text-muted-foreground">
            {t("calendar_search_empty")}
          </p>
        )}

      <CalendarMonthCard
        month={month}
        year={year}
        now={now}
        daysInMonth={daysInMonth}
        isCurrentMonth={isCurrentMonth}
        loading={loadingSubscriptions || spending.isLoading}
        selectedDay={selectedDay}
        selectedDate={selectedDate}
        allCells={allCells}
        entriesByDay={entriesByDay}
        entriesByDate={entriesByDate}
        onMoveToMonth={(entry) => {
          if (!paymentMutationsBusy) setMoveEntry(entry);
        }}
        mainCurrency={mainCurrency}
        currencyById={currencyById}
        paymentTracking={paymentTracking}
        paymentRecords={paymentRecords}
        onPrev={goToPreviousMonth}
        onNext={goToNextMonth}
        onGoToday={goToday}
        onSelectMonth={(selectedMonth, selectedYear) => {
          setSelectedDate(null);
          setMonth(selectedMonth);
          setYear(selectedYear);
        }}
        onSelectDay={setSelectedDay}
        onSelectDate={setSelectedDate}
        onAddHistorical={
          !loadingSubscriptions
            ? (date) => {
                setSelectedDate(date);
                setHistoricalOpen(true);
              }
            : undefined
        }
        onMovePayment={requestPaymentMove}
        movingPayment={paymentMutationsBusy}
      />

      {selectedDate !== null && !historicalOpen && !detailEntry && !markAsPaidEntry ? (
        <Dialog open onOpenChange={dialogDismissHandler(() => setSelectedDay(null))}>
          <DialogContent className="monline-scroll max-h-[85dvh] w-[96vw] max-w-3xl gap-0 overflow-y-auto p-0 [&>button]:hidden">
            <DialogHeader className="sr-only">
              <DialogTitle>{t("calendar_day_payments")}</DialogTitle>
              <DialogDescription>{t("calendar_desc")}</DialogDescription>
            </DialogHeader>
            <DayPanel
              day={selectedDate.getDate()}
              month={selectedDate.getMonth() + 1}
              year={selectedDate.getFullYear()}
              entries={selectionOutsideMonth ? selectedMonth.selectedEntries : selectedEntries}
              total={selectionOutsideMonth ? selectedMonth.selectedDayTotal : selectedDayTotal}
              mainCurrency={mainCurrency}
              currencies={currencies}
              now={now}
              t={t}
              paymentTracking={paymentTracking}
              paymentRecords={paymentRecords}
              onSelectEntry={(entry) => setDetailEntry(entry)}
              onClose={() => setSelectedDay(null)}
            />
          </DialogContent>
        </Dialog>
      ) : null}
      <UndatedStatementFees events={undatedFees} />

      {moveEntry && (
        <CalendarMoveDialog
          entry={moveEntry}
          moving={movePayment.isPending}
          onClose={() => setMoveEntry(null)}
          onMove={(date, mode) => requestPaymentMove(moveEntry, date, mode)}
        />
      )}
      {detailEntry?.spending ? (
        <SpendingDetailDialog
          event={detailEntry.spending}
          calendarDate={toDateStr(detailEntry.date)}
          onClose={() => setDetailEntry(null)}
          movingPayment={movePayment.isPending}
          onMoveDate={(date) => requestPaymentMove(detailEntry, date)}
        />
      ) : detailEntry ? (
        <SubDetailDialog
          sub={detailEntry.sub}
          date={detailEntry.date}
          currencies={currencies}
          mainCurrency={mainCurrency}
          paymentTracking={paymentTracking}
          paymentRecord={getPaymentRecord(
            paymentRecords,
            detailEntry.sub.id,
            toDateStr(detailEntry.date),
          )}
          onClose={() => setDetailEntry(null)}
          onEdit={() => {
            setPaymentMode("edit");
            setMarkAsPaidEntry(detailEntry);
            setDetailEntry(null);
          }}
          onMarkAsPaid={() => {
            setPaymentMode("confirm");
            setMarkAsPaidEntry(detailEntry);
            setDetailEntry(null);
          }}
          markingUnpaid={markUnpaid.isPending || movePayment.isPending}
          onMarkAsUnpaid={() => {
            if (
              markUnpaid.isPending ||
              removePayment.isPending ||
              clearCalendar.isPending ||
              movePayment.isPending
            )
              return;
            const record = getPaymentRecord(
              paymentRecords,
              detailEntry.sub.id,
              toDateStr(detailEntry.date),
            );
            if (record?.paid_at) markUnpaid.mutate(record);
          }}
          deletingPayment={
            removePayment.isPending || clearCalendar.isPending || movePayment.isPending
          }
          movingPayment={movePayment.isPending}
          onMoveDate={(date) => requestPaymentMove(detailEntry, date)}
          onDeletePayment={() => {
            const record = getPaymentRecord(
              paymentRecords,
              detailEntry.sub.id,
              toDateStr(detailEntry.date),
            );
            if (record) setDeletePayment(record);
          }}
          t={t}
        />
      ) : null}

      {markAsPaidEntry ? (
        <MarkAsPaidModal
          mode={paymentMode}
          sub={markAsPaidEntry.sub}
          date={markAsPaidEntry.date}
          userId={userId}
          existingRecord={getPaymentRecord(
            paymentRecords,
            markAsPaidEntry.sub.id,
            toDateStr(markAsPaidEntry.date),
          )}
          onClose={() => setMarkAsPaidEntry(null)}
          onSaved={() => {
            setMarkAsPaidEntry(null);
            void queryClient.invalidateQueries();
          }}
          t={t}
        />
      ) : null}

      <CalendarClearPaymentsDialog
        open={clearOpen}
        onOpenChange={setClearOpen}
        payments={calendarPaymentCount}
        busy={clearCalendar.isPending}
        onConfirm={() => clearCalendar.mutate()}
      />

      <ConfirmDialog
        open={!!deletePayment}
        onOpenChange={dialogDismissHandler(() => setDeletePayment(null))}
        title={t("calendar_delete_payment")}
        description={t("calendar_delete_payment_confirm")}
        onConfirm={() => {
          if (deletePayment) removePayment.mutate(deletePayment);
        }}
      />
    </div>
  );
}
