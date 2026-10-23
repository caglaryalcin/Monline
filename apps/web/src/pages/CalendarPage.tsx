import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { CalendarMonthCard } from "@/components/calendar/CalendarMonthCard";
import { CalendarOverview } from "@/components/calendar/CalendarOverview";
import { CalendarPageHeader } from "@/components/calendar/CalendarPageHeader";
import { DayPanel } from "@/components/calendar/DayPanel";
import { HistoricalPaymentDialog } from "@/components/calendar/HistoricalPaymentDialog";
import { MarkAsPaidModal } from "@/components/calendar/MarkAsPaidModal";
import { SubDetailDialog } from "@/components/calendar/SubDetailDialog";
import {
  type DayEntry,
  getPaymentRecord,
  parseLocalDate,
  toDateStr,
} from "@/components/calendar/types";
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
import { queryKeys } from "@/lib/queryKeys";
import { toast } from "@/lib/toast";
import { categoriesService } from "@/services/categories";
import { currenciesService } from "@/services/currencies";
import { cyclesService } from "@/services/cycles";
import { householdService } from "@/services/household";
import { paymentMethodsService } from "@/services/paymentMethods";
import { paymentRecordsService } from "@/services/paymentRecords";
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
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const selectedDay =
    selectedDate?.getFullYear() === year && selectedDate.getMonth() + 1 === month
      ? selectedDate.getDate()
      : null;
  const setSelectedDay = (day: number | null) =>
    setSelectedDate(day === null ? null : new Date(year, month - 1, day));
  const [detailEntry, setDetailEntry] = useState<DayEntry | null>(null);
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

  const markUnpaid = useMutation({
    mutationFn: (record: PaymentRecord) => paymentRecordsService.markUnpaid(record.id),
    onSuccess: async () => {
      await queryClient.invalidateQueries();
      toast.success(t("marked_as_unpaid"));
    },
    onError: () => toast.error(t("mark_as_unpaid_failed")),
  });

  const {
    data: subscriptions = [],
    isLoading: loadingSubscriptions,
    isError: subscriptionsError,
  } = useQuery({
    queryKey: queryKeys.subscriptions.all(userId),
    queryFn: () => subscriptionsService.list(userId),
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

  const { data: categories = [] } = useQuery({
    queryKey: queryKeys.categories.all(userId),
    queryFn: () => categoriesService.list(userId),
    enabled: !!userId,
  });

  const { data: paymentMethods = [] } = useQuery({
    queryKey: queryKeys.paymentMethods.all(userId),
    queryFn: () => paymentMethodsService.list(userId),
    enabled: !!userId,
  });

  const { data: household = [] } = useQuery({
    queryKey: queryKeys.household.all(userId),
    queryFn: () => householdService.list(userId),
    enabled: !!userId,
  });

  const {
    data: paymentRecords = [],
    isLoading: loadingPayments,
    isError: paymentsError,
  } = useQuery({
    queryKey: queryKeys.paymentRecords.all(userId),
    queryFn: () => paymentRecordsService.listForUser(userId),
    enabled: !!userId,
  });

  const calendarPaymentCount = paymentRecords.length;
  const hasCalendarEntries =
    calendarPaymentCount > 0 ||
    subscriptions.some((sub) => !sub.calendar_projection_hidden);

  const { allCells, currencyById, daysInMonth, entriesByDay, mainCurrency, stats } =
    useCalendarMonthData({
      subscriptions,
      cycles,
      currencies,
      year,
      month,
      selectedDay,
      paymentRecords,
    });

  const selectedMonth = useCalendarMonthData({
    subscriptions,
    cycles,
    currencies,
    paymentRecords,
    year: selectedDate?.getFullYear() ?? year,
    month: selectedDate ? selectedDate.getMonth() + 1 : month,
    selectedDay: selectedDate?.getDate() ?? null,
  });

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
        transferActions={<ScopedTransferActions scope="calendar" />}
        onAddHistorical={!loadingSubscriptions ? () => setHistoricalOpen(true) : undefined}
        onClearAll={() => setClearOpen(true)}
        clearDisabled={
          loadingSubscriptions ||
          loadingPayments ||
          clearCalendar.isPending ||
          removePayment.isPending ||
          markUnpaid.isPending ||
          !hasCalendarEntries
        }
      />

      {historicalOpen && (
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
        loading={loadingSubscriptions || loadingCurrencies || loadingPayments}
        hasError={subscriptionsError || currenciesError || paymentsError}
        mainCurrency={mainCurrency}
        budgetOverrun={budgetOverrun}
      />

      <CalendarMonthCard
        month={month}
        year={year}
        now={now}
        daysInMonth={daysInMonth}
        isCurrentMonth={isCurrentMonth}
        loading={loadingSubscriptions}
        selectedDay={selectedDay}
        selectedDate={selectedDate}
        allCells={allCells}
        entriesByDay={entriesByDay}
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
      />

      {selectedDate !== null && !historicalOpen && !detailEntry && !markAsPaidEntry ? (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open) setSelectedDay(null);
          }}
        >
          <DialogContent className="monline-scroll max-h-[85dvh] w-[96vw] max-w-3xl gap-0 overflow-y-auto p-0 [&>button]:hidden">
            <DialogHeader className="sr-only">
              <DialogTitle>{t("calendar_day_payments")}</DialogTitle>
              <DialogDescription>{t("calendar_desc")}</DialogDescription>
            </DialogHeader>
            <DayPanel
              day={selectedDate.getDate()}
              month={selectedDate.getMonth() + 1}
              year={selectedDate.getFullYear()}
              entries={selectedMonth.selectedEntries}
              total={selectedMonth.selectedDayTotal}
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

      {detailEntry ? (
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
          markingUnpaid={markUnpaid.isPending}
          onMarkAsUnpaid={() => {
            if (markUnpaid.isPending || removePayment.isPending || clearCalendar.isPending) return;
            const record = getPaymentRecord(
              paymentRecords,
              detailEntry.sub.id,
              toDateStr(detailEntry.date),
            );
            if (record?.paid_at) markUnpaid.mutate(record);
          }}
          deletingPayment={removePayment.isPending || clearCalendar.isPending}
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

      <ConfirmDialog
        open={clearOpen}
        confirmOnEnter
        onOpenChange={setClearOpen}
        title={t("calendar_clear_payments")}
        description={t("calendar_clear_confirm", {
          payments: calendarPaymentCount,
        })}
        onConfirm={() => clearCalendar.mutate()}
      />

      <ConfirmDialog
        open={!!deletePayment}
        onOpenChange={(open) => {
          if (!open) setDeletePayment(null);
        }}
        title={t("calendar_delete_payment")}
        description={t("calendar_delete_payment_confirm")}
        onConfirm={() => {
          if (deletePayment) removePayment.mutate(deletePayment);
        }}
      />
    </div>
  );
}
