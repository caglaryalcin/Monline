export type StatisticsGroupBy = "category" | "payment" | "member";

export interface StatisticsPieDatum {
  name: string;
  value: number;
  count?: number;
}

export interface StatisticsHistoryPoint {
  name: string;
  cost: number;
  isCurrent?: boolean;
}

export interface StatisticsSubscriptionDetail {
  id: string;
  name: string;
  value: number;
  count?: number;
}

export type StatisticsCategoryDetails = Record<string, StatisticsSubscriptionDetail[]>;
