import { Portal as TooltipPortal } from "@radix-ui/react-tooltip";
import { CreditCard, Droplets, Flame, House, Landmark, Smartphone, Wallet, Wifi, Zap } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { type BillType, type FinanceRow, type SalaryBasis, salaryBasisForYear } from "@/lib/finance";
import { cn } from "@/lib/utils";

const icons = {
  electricity: Zap,
  water: Droplets,
  internet: Wifi,
  gas: Flame,
  mobile: Smartphone,
  loan: Landmark,
  rent: House,
  credit_card: CreditCard,
  salary: Wallet,
  salary_gross: Wallet,
};

export function FinanceRowTag({
  type,
  label,
  salaryBasis,
}: {
  type: BillType | "loan" | "credit_card" | "rent" | "salary" | "salary_gross";
  label: string;
  salaryBasis?: SalaryBasis | "mixed";
}) {
  const { t } = useTranslation();
  const Icon = icons[type];
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            role="img"
            aria-label={label}
            tabIndex={0}
            className={cn(
              "inline-flex h-5 shrink-0 items-center justify-center rounded focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
              type === "salary" || type === "salary_gross" ? "gap-1 px-1.5" : "w-5",
              type === "credit_card"
                ? "ml-auto text-violet-600 dark:text-violet-400"
                : type === "loan"
                  ? "bg-amber-500/10 text-amber-700 dark:text-amber-300"
                  : type === "rent"
                    ? "bg-orange-500/10 text-orange-700 dark:text-orange-300"
                    : type === "salary" || type === "salary_gross"
                      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                    : "bg-sky-500/10 text-sky-700 dark:text-sky-300",
            )}
          >
            <Icon aria-hidden="true" className="h-3.5 w-3.5" />
            {(type === "salary" || type === "salary_gross") && (
              <span className="max-w-24 truncate text-[10px] leading-none">
                {t(`finance_salary_badge_${salaryBasis ?? (type === "salary_gross" ? "gross" : "net")}`)}
              </span>
            )}
          </span>
        </TooltipTrigger>
        <TooltipPortal>
          <TooltipContent side="top" className="text-xs">
            {label}
          </TooltipContent>
        </TooltipPortal>
      </Tooltip>
    </TooltipProvider>
  );
}

export function FinanceSalaryRowTag({ row, year }: { row: FinanceRow; year: number }) {
  const { t } = useTranslation();
  const basis = salaryBasisForYear(row, year);
  return (
    <FinanceRowTag
      type={basis === "gross" ? "salary_gross" : "salary"}
      salaryBasis={basis}
      label={t(`finance_salary_${basis}`)}
    />
  );
}
