import { useTranslation } from "react-i18next";

import { Card, CardContent } from "@/components/ui/card";
import { formatPrice } from "@/lib/utils";

interface StatisticsSummaryCardsProps {
  mainCode?: string;
  mainSymbol: string;
  subscriptionsCount: number;
  totalMonthly: number;
  totalYearly: number;
}

export function StatisticsSummaryCards({
  mainCode,
  mainSymbol,
  subscriptionsCount,
  totalMonthly,
  totalYearly,
}: StatisticsSummaryCardsProps) {
  const { t } = useTranslation();

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <Card className="group relative overflow-hidden rounded-3xl border bg-card/40 shadow-sm backdrop-blur-md">
        <CardContent className="relative p-6">
          <p className="text-sm font-medium text-muted-foreground">{t("total_monthly")}</p>
          <p className="mt-2 text-3xl font-extrabold tracking-tight">
            {formatPrice(totalMonthly, mainSymbol, { currencyCode: mainCode })}
          </p>
        </CardContent>
      </Card>

      <Card className="group relative overflow-hidden rounded-3xl border bg-card/40 shadow-sm backdrop-blur-md">
        <CardContent className="relative p-6">
          <p className="text-sm font-medium text-muted-foreground">{t("total_yearly")}</p>
          <p className="mt-2 text-3xl font-extrabold tracking-tight">
            {formatPrice(totalYearly, mainSymbol, { currencyCode: mainCode })}
          </p>
        </CardContent>
      </Card>

      <Card className="group relative overflow-hidden rounded-3xl border bg-card/40 shadow-sm backdrop-blur-md">
        <CardContent className="relative p-6">
          <p className="text-sm font-medium text-muted-foreground">{t("subscriptions")}</p>
          <p className="mt-2 text-3xl font-extrabold tracking-tight">{subscriptionsCount}</p>
        </CardContent>
      </Card>
    </div>
  );
}
