import { Check, CircleAlert, type LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useNumberLocale } from "@/hooks/useNumberLocale";
import type { PurchaseScenario } from "@/lib/affordability";
import { resolveLocale } from "@/lib/locale";
import { cn, formatCurrency } from "@/lib/utils";

interface ComparisonOption {
  id: string;
  label: string;
  icon: LucideIcon;
  result: PurchaseScenario;
}

export function AffordabilityComparisons({ options, selected, currency }: {
  options: ComparisonOption[]; selected: string; currency: string;
}) {
  const { t, i18n } = useTranslation();
  const locale = useNumberLocale();
  const dateLocale = resolveLocale(i18n);
  const money = (value: number) => formatCurrency(value, currency, { locale });
  const month = (value: string, year = false) => new Intl.DateTimeFormat(dateLocale, {
    month: "short", ...(year ? { year: "numeric" } : {}),
  }).format(new Date(`${value}-01T12:00:00Z`));
  const scale = Math.max(1, ...options.flatMap(option => option.result.points.map(point => Math.abs(point.after))));
  const period = options[0]?.result.points;

  return <TooltipProvider delayDuration={100}><Card className="rounded-2xl"><CardHeader>
    <CardTitle className="text-lg">{t("aff_compare")}</CardTitle>
    {period && period.length > 0 && <p className="text-xs text-muted-foreground">{month(period[0].month, true)} – {month(period[period.length - 1].month, true)}</p>}
  </CardHeader><CardContent><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
    {options.map(option => {
      const { result, icon: Icon } = option;
      const shortfall = result.minimum !== null && result.minimum < 0;
      const color = shortfall ? "text-red-700 dark:text-red-400" : "text-emerald-700 dark:text-emerald-400";
      const StatusIcon = shortfall ? CircleAlert : Check;
      return <article key={option.id} className={cn("min-w-0 space-y-4 rounded-2xl border bg-card p-4", option.id === selected && "border-primary/50 bg-primary/5")}>
        <div className="flex items-center gap-2">
          <span className="rounded-xl bg-muted p-2"><Icon className="h-5 w-5" aria-hidden="true" /></span>
          <h3 className="min-w-0 flex-1 text-sm font-semibold">{option.label}</h3>
          {option.id === selected && <span className="rounded-full bg-primary/10 px-2 py-1 text-[10px] font-semibold text-primary">{t("aff_selected_option")}</span>}
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{t("aff_minimum")}</p>
          <p className={cn("mt-1 break-words text-2xl font-bold tabular-nums", color)}>{result.minimum === null ? t("aff_none") : money(result.minimum)}</p>
        </div>
        <div className="grid grid-cols-6" role="group" aria-label={t("aff_chart")}>
            {result.points.map(point => {
              const height = Math.max(point.after === 0 ? 1 : 2, Math.abs(point.after) / scale * 36);
              return <Tooltip key={point.month}><TooltipTrigger asChild>
                <button type="button" className="min-w-0 rounded-md text-center hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={`${month(point.month, true)} · ${t("aff_after")}: ${money(point.after)}`}>
                  <span className="relative block h-20 w-full" aria-hidden="true">
                    <span className="absolute inset-x-0 top-1/2 h-px bg-border" />
                    <span className={cn("absolute left-1/2 w-1/2 max-w-6 -translate-x-1/2 rounded-sm", point.after < 0 ? "top-1/2 bg-red-500" : "bottom-1/2 bg-teal-500")}
                      style={{ height }} />
                  </span>
                  <span className="block pb-1 text-[10px] text-muted-foreground">{month(point.month)}</span>
                </button>
              </TooltipTrigger><TooltipContent side="top" sideOffset={8} className="space-y-1">
                <p className="text-xs font-semibold">{month(point.month, true)}</p>
                <p className="text-xs text-muted-foreground">{t("aff_after")}</p>
                <p className={cn("font-semibold tabular-nums", point.after < 0 ? "text-red-700 dark:text-red-400" : "text-emerald-700 dark:text-emerald-400")}>{money(point.after)}</p>
              </TooltipContent></Tooltip>;
            })}
        </div>
        <p className={cn("flex items-start gap-1.5 text-xs font-medium", color)}><StatusIcon className="h-4 w-4 shrink-0" aria-hidden="true" />{t(shortfall ? "aff_shortfall" : "aff_comfortable")}</p>
        <div className="grid grid-cols-2 gap-3 border-t pt-3 text-xs">
          <div><p className="text-muted-foreground">{t("aff_payment")}</p><p className="mt-1 break-words font-semibold tabular-nums">{money(result.monthlyPayment)}</p></div>
          <div><p className="text-muted-foreground">{t("aff_cost")}</p><p className="mt-1 break-words font-semibold tabular-nums">{money(result.totalCost)}</p></div>
        </div>
        {result.remainingDebt > 0 && <p className="border-t pt-3 text-xs text-muted-foreground">{t("aff_remaining")} <span className="font-semibold text-foreground">{money(result.remainingDebt)}</span></p>}
      </article>;
    })}
  </div></CardContent></Card></TooltipProvider>;
}
