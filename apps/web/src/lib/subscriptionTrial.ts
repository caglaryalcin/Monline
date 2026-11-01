import type { TrialSubscription } from "../../../backend/src/domain/lib/pure/subscription-trial.mjs";
import { isTrialDate as datedTrial, subscriptionAmount as datedAmount } from "../../../backend/src/domain/lib/pure/subscription-trial.mjs";
export { MAX_TRIAL_MONTHS, nextTrialPaymentDate, trialEndDate } from "../../../backend/src/domain/lib/pure/subscription-trial.mjs";
function localDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}
export function isTrialDate(subscription: TrialSubscription, date = localDate()) {
  return datedTrial(subscription, date);
}
export function subscriptionAmount(subscription: TrialSubscription, date = localDate()) {
  return datedAmount(subscription, date);
}
