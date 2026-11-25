import { Check } from "lucide-react";
import { useTranslation } from "react-i18next";

import {
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import { type FinanceRow, type SalaryBasis, salaryBasisForMonth } from "@/lib/finance";

export function FinanceSalaryBasisMenu({
  row,
  month,
  disabled = false,
  showRowName = false,
  onSelect,
}: {
  row: FinanceRow;
  month: string;
  disabled?: boolean;
  showRowName?: boolean;
  onSelect: (basis: SalaryBasis | "") => void;
}) {
  const { t } = useTranslation();
  const basis = salaryBasisForMonth(row, month);
  const selected = row.salary_basis_months?.[month] || "";
  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger disabled={disabled}>
        {showRowName ? row.name : t("finance_salary_month_type")}
        <span className="ml-2 text-xs text-muted-foreground">{t(`finance_salary_badge_${basis}`)}</span>
      </DropdownMenuSubTrigger>
      <DropdownMenuPortal>
        <DropdownMenuSubContent>
          {(["net", "gross"] as const).map((value) => (
            <DropdownMenuItem key={value} disabled={disabled} onSelect={() => onSelect(value)}>
              {t(`finance_salary_badge_${value}`)}
              {selected === value && <Check className="ml-auto h-4 w-4" aria-hidden="true" />}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled={disabled} onSelect={() => onSelect("")}>
            {t("finance_salary_use_row_basis", {
              basis: t(row.salary_basis === "gross" ? "finance_salary_badge_gross" : "finance_salary_badge_net"),
            })}
            {!selected && <Check className="ml-auto h-4 w-4" aria-hidden="true" />}
          </DropdownMenuItem>
        </DropdownMenuSubContent>
      </DropdownMenuPortal>
    </DropdownMenuSub>
  );
}
