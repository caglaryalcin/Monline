import { TrendingUp } from "lucide-react";
import type { CSSProperties } from "react";

import { Card, CardContent } from "@/components/ui/card";

export function SummaryCard({
  title,
  year,
  value,
  icon,
  loading,
  trend,
  trendUp,
  accent,
  description,
  comparison,
  valueLabel,
}: {
  title: string;
  year?: number;
  value: string;
  icon: React.ReactNode;
  loading?: boolean;
  trend?: string;
  trendUp?: boolean;
  accent: string;
  description?: string;
  comparison?: { value: string; label: string; title?: string };
  valueLabel?: string;
}) {
  return (
    <Card
      className="summary-card relative h-[130px] min-w-0 overflow-hidden rounded-3xl border bg-card shadow-sm [container-type:inline-size]"
      style={{ "--summary-accent": accent, containerName: "summary-card" } as CSSProperties}
    >
      <CardContent className="summary-card__content relative grid h-full grid-rows-[2.75rem_1fr_1rem] gap-1 px-4 py-3">
        <div className="summary-card__header flex items-center gap-3">
          <div className="summary-card-icon shrink-0 rounded-xl p-2.5 [&>svg]:h-[22px] [&>svg]:w-[22px]">
            {icon}
          </div>
          <div className="min-w-0 flex-1">
            {year !== undefined && (
              <p className="summary-card__year mb-0.5 text-sm font-semibold leading-4 text-muted-foreground">
                {year}
              </p>
            )}
            <p className="summary-card__title text-base font-medium leading-5 text-muted-foreground" title={title}>
              {title}
            </p>
          </div>
          {trend && (
            <span
              className={`text-sm font-bold px-2.5 py-1 flex shrink-0 items-center gap-1 rounded-full ${
                trendUp !== false ? "bg-green-500/20 text-green-600" : "bg-red-500/20 text-red-600"
              }`}
            >
              <TrendingUp className={`w-3 h-3 ${trendUp === false && "rotate-180"}`} />
              {trend}
            </span>
          )}
        </div>
        <div className="flex min-w-0 items-end">
          {loading ? (
            <div className="h-9 w-28 animate-pulse rounded-lg bg-background/60" />
          ) : comparison ? (
            <div className="grid w-full grid-cols-2 items-center gap-2">
              <p className="truncate text-[length:calc(clamp(0.875rem,8cqi,1.5rem)_+_2px)] font-extrabold leading-7 tracking-tight tabular-nums" title={comparison.title || comparison.value}>{comparison.value}</p>
              <p className="truncate text-[length:calc(clamp(0.875rem,8cqi,1.5rem)_+_2px)] font-extrabold leading-7 tracking-tight tabular-nums" title={value}>{value}</p>
            </div>
          ) : (
            <p className="truncate text-[length:calc(clamp(1rem,10cqi,1.75rem)_+_2px)] font-extrabold leading-7 tracking-tight tabular-nums" title={value}>
              {value}
            </p>
          )}
        </div>
        <div className="text-[13px] leading-4 text-muted-foreground">
          {!loading && comparison && <div className="grid grid-cols-2 gap-2">
            <p className="truncate" title={comparison.title}>{comparison.label}</p>
            <p className="truncate">{valueLabel}</p>
          </div>}
          <p className="truncate" title={description}>{!loading ? description : null}</p>
        </div>
      </CardContent>
    </Card>
  );
}
