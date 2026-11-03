export interface SubscriptionPriceChange {
  effective_date: string;
  price: number;
}
export interface PricedSubscription {
  price?: unknown;
  price_changes?: SubscriptionPriceChange[] | null;
  get?: (key: string) => unknown;
}
export function subscriptionPrice(subscription: PricedSubscription, date: string): number;
export function validatePriceChanges(input: unknown): SubscriptionPriceChange[];
