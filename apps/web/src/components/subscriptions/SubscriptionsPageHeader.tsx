import { Plus } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";

interface SubscriptionsPageHeaderProps {
  onCreate: () => void;
}

export function SubscriptionsPageHeader({ onCreate }: SubscriptionsPageHeaderProps) {
  const { t } = useTranslation();
  return (
    <div className="flex shrink-0 justify-start">
      <Button
        className="h-11 w-full rounded-xl bg-gradient-to-r from-primary/90 to-primary font-semibold shadow-md transition-all sm:w-auto"
        onClick={onCreate}
      >
        <Plus className="mr-1.5 h-5 w-5" />
        {t("add_subscription")}
      </Button>
    </div>
  );
}
