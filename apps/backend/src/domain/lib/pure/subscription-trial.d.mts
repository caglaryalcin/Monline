export interface TrialSubscription {
  price?: unknown;
  trial_months?: number;
  trial_start_date?: string;
  record_type?: string;
  billing_anchor_day?: number;
  get?: (key: string) => unknown;
}
export const MAX_TRIAL_MONTHS: number;
export function trialEndDate(subscription: TrialSubscription): string;
export function isTrialDate(subscription: TrialSubscription, date: string): boolean;
export function subscriptionAmount(subscription: TrialSubscription, date: string): number;
export function nextTrialPaymentDate(subscription: TrialSubscription, date: string, anchorDay?: number): string;
