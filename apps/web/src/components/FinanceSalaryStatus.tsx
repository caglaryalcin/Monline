import { Portal as TooltipPortal } from "@radix-ui/react-tooltip";
import { Check, CircleDot, Clock } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const appearance = {
  settled: { icon: Check, label: "finance_income_received", color: "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" },
  planned: { icon: Clock, label: "finance_income_expected", color: "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300" },
  partial: { icon: CircleDot, label: "finance_salary_partly_received", color: "border-sky-500/25 bg-sky-500/10 text-sky-700 dark:text-sky-300" },
};
export function FinanceSalaryStatus({ status }: { status: keyof typeof appearance | null }) {
  const { t } = useTranslation();
  if (!status) return null;
  const { icon: Icon, label, color } = appearance[status];
  return <TooltipProvider delayDuration={150}><Tooltip>
    <TooltipTrigger asChild>
      <span role="img" aria-label={t(label)} tabIndex={0}
        className={cn("absolute left-0.5 top-0.5 inline-flex h-3.5 w-3.5 items-center justify-center rounded-sm border opacity-75 transition-opacity hover:opacity-100 focus-visible:opacity-100 focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-ring", color)}>
        <Icon className="h-2.5 w-2.5" aria-hidden="true" />
      </span>
    </TooltipTrigger>
    <TooltipPortal><TooltipContent side="top" className="text-xs">{t(label)}</TooltipContent></TooltipPortal>
  </Tooltip></TooltipProvider>;
}
