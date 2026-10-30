import { useState } from "react";

import {
  type SubscriptionSection,
  SubscriptionSections,
} from "@/components/subscriptions/SubscriptionSections";

export function SubscriptionsPage() {
  const [section, setSection] = useState<SubscriptionSection>("online");
  return (
    <SubscriptionSections
      section={section}
      sections={["online", "bills"]}
      onSectionChange={(value) => setSection(value as SubscriptionSection)}
    />
  );
}
