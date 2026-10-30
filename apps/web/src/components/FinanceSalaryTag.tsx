import { Portal as TooltipPortal } from "@radix-ui/react-tooltip";
import { Award, BadgePercent, Briefcase, TrendingUp } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { SalaryTag } from "@/lib/finance";
import { SALARY_TAG_STYLES } from "@/lib/salaryTagStyles";
import { cn } from "@/lib/utils";

const appearance = {
  job_change: { icon: Briefcase },
  raise: { icon: TrendingUp },
  seniority_raise: { icon: Award },
  seniority_inflation_raise: { icon: BadgePercent },
};
export function FinanceSalaryTag({ tag }: { tag: SalaryTag }) {
  const { t } = useTranslation();
  const label = t(`finance_salary_tag_${tag}`);
  const { icon: Icon } = appearance[tag];
  const { text, background } = SALARY_TAG_STYLES[tag];
  return <TooltipProvider delayDuration={150}><Tooltip>
    <TooltipTrigger asChild><span role="img" aria-label={label} className={cn("inline-flex h-5 w-5 shrink-0 items-center justify-center rounded", text, background)}>
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
    </span></TooltipTrigger>
    <TooltipPortal><TooltipContent side="top" className="text-xs">{label}</TooltipContent></TooltipPortal>
  </Tooltip></TooltipProvider>;
}
