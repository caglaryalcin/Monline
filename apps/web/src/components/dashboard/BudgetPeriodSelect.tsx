import { useTranslation } from "react-i18next";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BUDGET_PERIODS, type BudgetPeriod } from "@/lib/budgetPeriod";

export function BudgetPeriodSelect({ value, onChange }: { value: BudgetPeriod; onChange: (value: BudgetPeriod) => void }) {
  const { t } = useTranslation();
  return (
    <Select value={String(value)} onValueChange={(selection) => {
      const months = Number(selection) as BudgetPeriod;
      if (BUDGET_PERIODS.includes(months)) onChange(months);
    }}>
      <SelectTrigger aria-label={t("budget_period")} className="h-8 w-[135px] shrink-0 rounded-lg bg-background text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {BUDGET_PERIODS.map((months) => <SelectItem key={months} value={String(months)}>{t(`budget_period_${months}`)}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}
