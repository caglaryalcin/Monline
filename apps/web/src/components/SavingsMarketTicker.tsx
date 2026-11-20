import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { useAuth } from "@/contexts/AuthContext";
import { useNumberLocale } from "@/hooks/useNumberLocale";
import { formatNumber } from "@/lib/numberFormat";
import { cn, formatCurrency } from "@/lib/utils";
import { savingsRatesKey, savingsRatesRefetchInterval, savingsService } from "@/services/savings";

export function SavingsMarketTicker() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const locale = useNumberLocale();
  const rates = useQuery({ queryKey: savingsRatesKey(user?.id), queryFn: savingsService.rates,
    enabled: !!user?.id, staleTime: 15000, refetchInterval: savingsRatesRefetchInterval });
  const data = rates.data;
  const quotes = data?.market_quotes ?? ["USD", "EUR", "GBP", "CHF", "GRA", "CEYREKALTIN", "YARIMALTIN", "TAMALTIN", "CUMHURIYETALTINI"].flatMap(symbol => {
    const price = data?.rates[symbol];
    return price ? [{ symbol, bid: price, ask: price, change_percent: null, currency: "TRY" }] : [];
  });
  const stale = !!data?.stale || rates.isError;
  const stopped = !!user?.disable_gifs;
  const label = (symbol: string) => symbol === "XAUUSD" ? t("savings_ticker_ounce") : symbol === "GRA" ? t("savings_ticker_gram") : symbol.length === 3 ? symbol : t(`savings_asset_${symbol}`);
  const renderQuotes = (copy: number) => <ul key={copy} aria-hidden={copy === 1 ? true : undefined} className="savings-market-group">
    {quotes.map(quote => <li key={quote.symbol} className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap">
      <span className="font-semibold">{label(quote.symbol)}</span>
      <span className="tabular-nums">{formatCurrency(quote.bid, quote.currency, { locale, minimumFractionDigits: 2, maximumFractionDigits: quote.symbol.length === 3 ? 4 : 2 })}</span>
      {quote.change_percent !== null && <span className={cn("tabular-nums", quote.change_percent > 0 ? "text-emerald-700 dark:text-emerald-400" : quote.change_percent < 0 ? "text-red-700 dark:text-red-400" : "text-muted-foreground")}>
        {quote.change_percent > 0 ? "▲" : quote.change_percent < 0 ? "▼" : "•"} {formatNumber(Math.abs(quote.change_percent) / 100, { style: "percent", minimumFractionDigits: 2, maximumFractionDigits: 2 }, locale)}
      </span>}
    </li>)}
  </ul>;
  return <aside aria-label={t("savings_ticker_title")} className="min-w-0 shrink-0 border-t bg-muted/30">
    <div className="flex min-w-0 items-center gap-3 px-3 py-2.5">
      <span className={cn("inline-flex shrink-0 items-center gap-1.5 text-[10px] font-semibold tracking-wide", stale ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground")}>
        <span aria-hidden="true" className={cn("h-1.5 w-1.5 rounded-full", !quotes.length || stale ? "bg-amber-500" : "bg-red-500")} />
        {t(!quotes.length ? "savings_ticker_waiting" : stale ? "savings_ticker_delayed" : data?.valuation_side === "bid" ? "savings_ticker_auto" : "savings_ticker_reference")}
      </span>
      <div className="savings-market-viewport min-w-0 flex-1" data-paused={stopped}>
        {quotes.length ? <div className="savings-market-track text-xs">{renderQuotes(0)}{renderQuotes(1)}</div> :
          <p role="status" className="text-xs text-muted-foreground">{t(rates.isPending ? "loading" : "savings_rates_unavailable")}</p>}
      </div>
    </div>
  </aside>;
}
