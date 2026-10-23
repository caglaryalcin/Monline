export type SubscriptionSortKey = "name" | "price" | "date" | "status";
export type SubscriptionPriceDisplay = "billing" | "monthly" | "yearly";
export type SubscriptionAutomationSetting = "auto_renew" | "auto_mark_paid";

export interface SubscriptionFiltersState {
  categories: string[];
  members: string[];
  payments: string[];
  state: "all" | "active" | "inactive";
}

export const INITIAL_SUBSCRIPTION_FILTERS: SubscriptionFiltersState = {
  categories: [],
  members: [],
  payments: [],
  state: "all",
};
