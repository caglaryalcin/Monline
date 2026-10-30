import { useNavigate, useSearch } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { SubscriptionSections } from "@/components/subscriptions/SubscriptionSections";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function DebtPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const search = useSearch({ strict: false });
  const section = search.tab === "loans" ? "loans" : "installments";
  return (
    <div className="space-y-6">
      <Tabs
        value={section}
        onValueChange={(value) =>
          void navigate({
            to: "/debt",
            search: { tab: value === "loans" ? "loans" : "installments" },
            replace: true,
          })
        }
      >
        <TabsList className="h-auto flex-wrap justify-start gap-1">
          <TabsTrigger value="installments">{t("spending_section_installments")}</TabsTrigger>
          <TabsTrigger value="loans">{t("spending_section_loans")}</TabsTrigger>
        </TabsList>
      </Tabs>
      <SubscriptionSections section={section} />
    </div>
  );
}
