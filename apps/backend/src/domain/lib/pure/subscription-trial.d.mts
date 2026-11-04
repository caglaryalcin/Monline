export interface TrialSubscription {
  price?: unknown;
  price_changes?: import("./subscription-prices.mjs").SubscriptionPriceChange[] | null;
  trial_months?: number;
  trial_duration?: number;
  trial_unit?: "day" | "week" | "month" | "year" | "";
  trial_start_date?: string;
  record_type?: string;
  billing_anchor_day?: number;
  get?: (key: string) => unknown;
}
export const MAX_TRIAL_MONTHS: number;
export const TRIAL_LIMITS: Record<"day" | "week" | "month" | "year", number>;
export function trialEndDate(subscription: TrialSubscription): string;
export function isTrialDate(subscription: TrialSubscription, date: string): boolean;
export function subscriptionAmount(subscription: TrialSubscription, date: string): number;
export function nextTrialPaymentDate(subscription: TrialSubscription, date: string, anchorDay?: number, cycleName?: string): string;
