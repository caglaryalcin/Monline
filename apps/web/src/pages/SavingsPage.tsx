import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Banknote, Coins, DollarSign, Euro, Lightbulb, Pencil, PiggyBank, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { SummaryCard } from "@/components/dashboard/SummaryCard";
import { FinanceAnimationIcon } from "@/components/FinanceAnimationIcon";
import { PageLoading } from "@/components/PageLoading";
import { SavingsEditor } from "@/components/SavingsEditor";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { ThemedSelect } from "@/components/ui/themed-select";
import { useAuth } from "@/contexts/AuthContext";
import { useFinanceCurrency } from "@/hooks/useFinanceCurrency";
import { useNumberLocale } from "@/hooks/useNumberLocale";
import { resolveDateLocale } from "@/lib/locale";
import { formatNumber } from "@/lib/numberFormat";
import { isGoldSavingsAsset, isSavingsCurrency, type Saving, savingsPrecision, savingsUnitRate, savingsValue } from "@/lib/savings";
import { cn, formatCurrency, getCurrencyFractionDigits, getCurrencySymbol } from "@/lib/utils";
import { savingsService } from "@/services/savings";

export function SavingsPage() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const mainCurrency = useFinanceCurrency({ convert: false });
  const locale = useNumberLocale();
  const dateLocale = resolveDateLocale(i18n, user?.country);
  const queryClient = useQueryClient();
  const key = ["savings", user?.id];
  const ratesKey = ["savings-rates", user?.id, "fixer"];
  const [selection, setSelection] = useState<{ owner: string; currency: string } | null>(null);
  const currency = selection && selection.owner === user?.id ? selection.currency : mainCurrency.currency;
  const [editor, setEditor] = useState<{ saving?: Saving } | null>(null);
  const [editorPending, setEditorPending] = useState(false);
  const [deleting, setDeleting] = useState<Saving | null>(null);
  const holdings = useQuery({ queryKey: key, queryFn: savingsService.list, enabled: !!user?.id });
  const rates = useQuery({
    queryKey: ratesKey, queryFn: savingsService.rates,
    enabled: !!user?.id, staleTime: 60000, refetchInterval: 5 * 60 * 1000,
  });
  const refreshRates = useMutation({
    mutationFn: savingsService.refreshRates,
    onSuccess: (data) => queryClient.setQueryData(ratesKey, data),
    onError: () => toast.error(t("savings_rates_unavailable")),
  });
  const remove = useMutation({
    mutationFn: savingsService.remove,
    onSuccess: () => {
      setDeleting(null);
      toast.success(t("savings_deleted"));
      void queryClient.invalidateQueries({ queryKey: key });
    },
    onError: () => toast.error(t("savings_delete_error")),
  });
  const records = holdings.data || [];
  const valued = records.map((saving) => ({ saving, value: savingsValue(saving, rates.data, currency) }));
  const missing = valued.filter((item) => item.value === null).length;
  const scale = 10 ** getCurrencyFractionDigits(currency);
  const total = valued.reduce((sum, item) => sum + Math.round((item.value || 0) * scale), 0) / scale;
  const money = (value: number) => formatCurrency(value, currency, { locale });
  const currencyLabel = currency === "TRY" ? "TL" : currency;
  const currencyOptions = [...new Set([
    "TRY", "USD", "EUR", "GBP", ...Object.keys(rates.data?.currency_rates || {}).filter(isSavingsCurrency).sort(), currency,
  ])];
  const rateAvailable = !!rates.data && Object.keys(rates.data.rates).length > 0;
  const extraCurrencies = [...new Set(records.map((saving) => saving.asset)
    .filter((asset) => isSavingsCurrency(asset) && asset !== "USD" && asset !== "EUR"))]
    .sort((a, b) => Number(b === "TRY") - Number(a === "TRY") || a.localeCompare(b));
  const groups = [
    { id: "gold", label: "savings_gold", icon: Coins, accent: "234 179 8" },
    { id: "EUR", label: "savings_asset_EUR", icon: Euro, accent: "59 130 246" },
    { id: "USD", label: "savings_asset_USD", icon: DollarSign, accent: "34 197 94" },
    ...extraCurrencies.map((code) => ({ id: code, label: `savings_asset_${code}`, icon: Banknote, accent: "20 184 166" })),
  ];

  const renderSavingCard = ({ saving, value }: (typeof valued)[number]) => {
    const isCurrency = isSavingsCurrency(saving.asset);
    const unit = isCurrency ? saving.asset === "TRY" ? "TL" : saving.asset : t(saving.asset === "GRA" ? "savings_unit_gram" : "savings_unit_piece");
    const rate = savingsUnitRate(saving.asset, rates.data, currency);
    return <article key={saving.id} className="group relative flex min-w-0 flex-col justify-between overflow-hidden rounded-2xl border bg-card/60 p-4 backdrop-blur-sm transition-all duration-300">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 basis-24 flex-1">
          <h2 className="text-sm font-medium text-muted-foreground [overflow-wrap:anywhere]">{saving.name}</h2>
          <p className="mt-1 text-lg font-bold leading-tight [overflow-wrap:anywhere]">{t(`savings_asset_${saving.asset}`, { defaultValue: saving.asset })}</p>
        </div>
        <p className="ml-auto max-w-full text-right font-mono text-xl font-extrabold tracking-tight [overflow-wrap:anywhere]">
          {formatNumber(saving.quantity, { maximumFractionDigits: savingsPrecision(saving.asset) }, locale)} {unit}
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-xl border bg-background/50 px-3 py-2">
        <p className="text-xs text-muted-foreground">{t("savings_value", { currency: currencyLabel })}</p>
        <p className="min-w-0 text-sm font-semibold tabular-nums [overflow-wrap:anywhere]">{value === null ? t("savings_rate_missing") : money(value)}</p>
      </div>

      {saving.notes && <p className="mt-3 whitespace-pre-wrap break-words text-xs text-muted-foreground">{saving.notes}</p>}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
        {rate !== null && <div className="min-w-0 basis-28 flex-1 text-xs">
          <p className="text-muted-foreground">{t("savings_rate")}</p>
          <p className="mt-1 font-medium tabular-nums text-foreground/80 [overflow-wrap:anywhere]">{formatCurrency(rate, currency, { locale, maximumFractionDigits: 2, minimumFractionDigits: 2 })}</p>
        </div>}
        <div className="ml-auto flex max-w-full shrink-0 items-center gap-1 rounded-full border bg-background/80 p-1 shadow-sm backdrop-blur">
          <Button type="button" size="icon" variant="ghost" className="h-7 w-7 rounded-full text-muted-foreground" onClick={() => setEditor({ saving })} aria-label={`${t("edit")}: ${saving.name}`} title={t("edit")}><Pencil className="h-3.5 w-3.5" /></Button>
          <Button type="button" size="icon" variant="ghost" className="h-7 w-7 rounded-full text-muted-foreground" onClick={() => setDeleting(saving)} aria-label={`${t("delete")}: ${saving.name}`} title={t("delete")}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
        </div>
      </div>
    </article>;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-end gap-4">
        <div className="flex flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Label htmlFor="savings-display-currency" className="text-xs text-muted-foreground">{t("savings_display_currency")}</Label>
            <ThemedSelect id="savings-display-currency" value={currency} className="h-10 min-w-28 rounded-xl"
              onChange={(event) => setSelection({ owner: user?.id || "", currency: event.target.value })}>
              {currencyOptions.map((code) => {
                const symbol = getCurrencySymbol(code, locale);
                return <option key={code} value={code}>{symbol === code ? code : `${code} (${symbol})`}</option>;
              })}
            </ThemedSelect>
          </div>
          <Button variant="outline" disabled={rates.isFetching || refreshRates.isPending} onClick={() => refreshRates.mutate()}>
            <RefreshCw className={cn("mr-2 h-4 w-4", (rates.isFetching || refreshRates.isPending) && "animate-spin")} />
            {t("savings_rates_refresh")}
          </Button>
          <Button onClick={() => setEditor({})}><Plus className="mr-2 h-4 w-4" />{t("savings_add")}</Button>
        </div>
      </div>

      {holdings.isPending || mainCurrency.currencies.isPending ? <PageLoading /> : holdings.isError || !mainCurrency.main ? (
        <div role="alert" className="rounded-xl border border-destructive/30 p-5 text-sm">
          <p>{t("savings_load_error")}</p>
          <Button className="mt-3" variant="outline" onClick={() => void Promise.all([holdings.refetch(), mainCurrency.currencies.refetch()])}>{t("savings_retry")}</Button>
        </div>
      ) : <>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,180px),1fr))] items-start gap-4">
          {groups.map(({ id, label, icon: Icon, accent }) => {
            const items = valued.filter(({ saving }) => id === "gold"
              ? isGoldSavingsAsset(saving.asset) : saving.asset === id);
            const unavailable = items.some((item) => item.value === null);
            const sum = items.reduce((value, item) => value + Math.round((item.value || 0) * scale), 0) / scale;
            const animation = id === "gold" ? "gold" : id === "USD" ? "dollar" : id === "EUR" ? "euro" : null;
            return <section key={id} className="min-w-0 space-y-4" aria-label={t(label, { defaultValue: id })}>
              <div className={cn(animation && "finance-animated-card")}>
                <SummaryCard
                  title={t(label, { defaultValue: id })}
                  value={unavailable ? "—" : money(sum)}
                  icon={animation ? <FinanceAnimationIcon asset={animation} fallback={<Icon aria-hidden="true" />} /> : <Icon aria-hidden="true" />}
                  accent={accent}
                  description={t("savings_entry_count", { count: items.length })}
                />
              </div>
              {items.map(renderSavingCard)}
            </section>;
          })}
          <div className="finance-animated-card [grid-column-end:-1]">
            <SummaryCard
              title={t(missing ? "savings_partial_total" : "savings_total")}
              value={records.length > 0 && missing === records.length ? "—" : money(total)}
              icon={<FinanceAnimationIcon asset="wallet" fallback={<span aria-hidden="true" className="inline-flex h-[22px] w-[22px] items-center justify-center text-xl leading-none">💰</span>} />}
              accent="139 92 246"
              description={t("savings_entry_count", { count: records.length })}
            />
          </div>
        </div>

        {records.length === 0 && <div className="flex flex-col items-center rounded-2xl border border-dashed px-6 py-14 text-center">
          <PiggyBank className="mb-4 h-12 w-12 text-primary/70" />
          <h2 className="font-semibold">{t("savings_empty_title")}</h2>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">{t("savings_empty_help")}</p>
          <Button className="mt-5" onClick={() => setEditor({})}><Plus className="mr-2 h-4 w-4" />{t("savings_add")}</Button>
        </div>}
        <footer className="flex items-start gap-2 border-t pt-4 text-xs text-muted-foreground">
          <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
          <div className="min-w-0 space-y-2 leading-relaxed">
            <p>{t("savings_rates_help")}</p>
            <p className="flex flex-wrap gap-x-3 gap-y-1">
              <a className="underline underline-offset-2" href="https://fixer.io/" target="_blank" rel="noreferrer">Fixer.io</a>
              {rates.data?.as_of && <span>{t("savings_rates_as_of", {
                date: new Intl.DateTimeFormat(dateLocale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(rates.data.as_of)),
              })}</span>}
            </p>
            {(!rates.isPending || rateAvailable) && (!rateAvailable || rates.data?.stale || rates.isError) &&
              <p role="status" className="font-medium text-amber-700 dark:text-amber-400">
                {t(rates.data?.status === "not_configured" ? "savings_fixer_not_configured" :
                  rateAvailable ? "savings_rates_stale" : "savings_rates_unavailable")}
              </p>}
            {rates.data?.status === "gold_unavailable" && <p role="status" className="font-medium text-amber-700 dark:text-amber-400">{t("savings_gold_unavailable")}</p>}
            {missing > 0 && <p role="status">{t("savings_missing_values", { count: missing })}</p>}
          </div>
        </footer>
      </>}

      <Dialog open={editor !== null} onOpenChange={(open) => { if (!open && !editorPending) setEditor(null); }}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
          {editor && <SavingsEditor key={editor.saving?.id || "new"} saving={editor.saving} rates={rates.data} currency={currency}
            onPendingChange={setEditorPending} onCancel={() => setEditor(null)} onSaved={() => {
              setEditor(null);
              void queryClient.invalidateQueries({ queryKey: key });
            }} />}
        </DialogContent>
      </Dialog>
      <AlertDialog open={deleting !== null} onOpenChange={(open) => { if (!open && !remove.isPending) setDeleting(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("savings_delete_title")}</AlertDialogTitle>
            <AlertDialogDescription>{t("savings_delete_help", { name: deleting?.name })}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={remove.isPending}>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction disabled={remove.isPending} className="bg-destructive text-destructive-foreground"
              onClick={(event) => { event.preventDefault(); if (deleting) remove.mutate(deleting.id); }}>
              {t(remove.isPending ? "loading" : "delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
