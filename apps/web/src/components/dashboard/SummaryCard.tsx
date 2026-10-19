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
}: {
  title: string;
  year?: number;
  value: string;
  icon: React.ReactNode;
  loading?: boolean;
  trend?: string;
  trendUp?: boolean;
  accent: string;
}) {
  return (
    <Card
      className="summary-card relative min-w-0 overflow-hidden rounded-3xl border bg-card shadow-sm [container-type:inline-size]"
      style={{ "--summary-accent": accent } as CSSProperties}
    >
      <CardContent className="relative px-3 pb-3 pt-3 sm:px-4 sm:pt-4">
        <div className="mb-3 flex items-center gap-2 sm:gap-3">
          <div className="summary-card-icon shrink-0 rounded-xl p-2 sm:p-2.5 [&>svg]:h-4 [&>svg]:w-4 sm:[&>svg]:h-6 sm:[&>svg]:w-6">
            {icon}
          </div>
          <div className="min-w-0 flex-1">
            {year !== undefined && (
              <p className="mb-0.5 text-xs font-semibold leading-tight text-muted-foreground">
                {year}
              </p>
            )}
            <p className="text-xs font-medium leading-snug text-muted-foreground sm:text-sm">
              {title}
            </p>
          </div>
          {trend && (
            <span
              className={`text-xs font-bold px-2.5 py-1 flex shrink-0 items-center gap-1 rounded-full ${
                trendUp !== false ? "bg-green-500/20 text-green-600" : "bg-red-500/20 text-red-600"
              }`}
            >
              <TrendingUp className={`w-3 h-3 ${trendUp === false && "rotate-180"}`} />
              {trend}
            </span>
          )}
        </div>
        <div>
          {loading ? (
            <div className="h-8 w-24 animate-pulse rounded-lg bg-background/60" />
          ) : (
            <p className="break-words text-[clamp(1rem,10cqi,1.875rem)] font-extrabold leading-tight tracking-tight tabular-nums sm:text-[clamp(1.25rem,11cqi,1.875rem)]">
              {value}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
