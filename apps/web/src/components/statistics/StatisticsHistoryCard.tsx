import { CostHistoryCard } from "@/components/dashboard/CostHistoryCard";
import type { StatisticsHistoryPoint } from "@/components/statistics/statistics.types";
import { formatPrice } from "@/lib/utils";

interface StatisticsHistoryCardProps {
  data: StatisticsHistoryPoint[];
  mainCode?: string;
  mainSymbol: string;
}

export function StatisticsHistoryCard({ data, mainCode, mainSymbol }: StatisticsHistoryCardProps) {
  return (
    <CostHistoryCard
      data={data}
      className=""
      currencySymbol={mainSymbol}
      formatValue={(value) => formatPrice(value, mainSymbol, { currencyCode: mainCode })}
    />
  );
}
