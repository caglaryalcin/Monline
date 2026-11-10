import { useSearch } from "@tanstack/react-router";

import { SubscriptionSections } from "@/components/subscriptions/SubscriptionSections";

export function DebtPage() {
  const search = useSearch({ strict: false });
  const section = search.tab === "loans" ? "loans" : "installments";
  return <SubscriptionSections section={section} />;
}
