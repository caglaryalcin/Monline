import type { TrialSubscription } from "./subscription-trial.mjs";
export interface BillingPause { from: string; to: string }
export interface BillingPauseSubscription extends TrialSubscription {
  billing_pauses?: BillingPause[] | null;
  next_payment?: string;
  frequency?: number;
}
export function validateBillingPauses(raw: unknown): BillingPause[];
export function billingPauseOn(subscription: BillingPauseSubscription, date: string): BillingPause | undefined;
export function isBillingPaused(subscription: BillingPauseSubscription, date: string): boolean;
export function planBillingPause(subscription: BillingPauseSubscription, cycleName: string, afterCycles: number, duration: number, today: string): BillingPause;
export function nextUnpausedBillingDate(subscription: BillingPauseSubscription, cycleName: string): string;
