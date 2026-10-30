import { Building2 } from "lucide-react";
import { useContext } from "react";
import { useTranslation } from "react-i18next";

import { SubscriptionLogo } from "@/components/SubscriptionLogo";
import { MerchantLogosContext } from "@/contexts/MerchantLogosContext";
import { findBillProvider } from "@/lib/billProviders";
import type { FinanceRow } from "@/lib/finance";
import { resolveMerchantLogo } from "@/lib/merchantLogo";

export function FinanceRowProvider({ row, year, month, monthName }: {
  row: FinanceRow;
  year: number;
  month?: number;
  monthName: (index: number, short?: boolean) => string;
}) {
  const { t } = useTranslation();
  const { choices } = useContext(MerchantLogosContext);
  const automatic = findBillProvider(row.name);
  const groups = new Map<string, { name: string; domain: string; months: number[] }>();
  const months = month ? [month - 1] : Array.from({ length: 12 }, (_, index) => index);
  for (const index of months) {
    const choice = resolveMerchantLogo(choices, row.name, {
      month: `${year}-${String(index + 1).padStart(2, "0")}`,
      rowId: row.origin_row || row.id,
    });
    const name = choice?.provider_name || automatic?.name || "";
    const domain = choice?.domain || automatic?.domain || "";
    const key = JSON.stringify([name, domain]);
    const group: { name: string; domain: string; months: number[] } = groups.get(key) || { name, domain, months: [] };
    group.months.push(index);
    groups.set(key, group);
  }
  return (
    <section className="space-y-2" aria-label={t("spending_provider")}>
      <p className="text-sm font-medium">{t("spending_provider")} <span className="font-normal text-muted-foreground">· {month ? `${monthName(month - 1)} ${year}` : year}</span></p>
      <div className="divide-y rounded-xl border bg-muted/10">
        {[...groups].map(([key, group]) => (
          <div key={key} className="flex items-center gap-3 p-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-background">
              {group.name ? <SubscriptionLogo sub={{ name: group.name, url: `https://${group.domain}` }} />
                : <Building2 className="h-4 w-4 text-muted-foreground" aria-hidden="true" />}
            </span>
            <div className="min-w-0">
              <p className="break-words text-sm font-medium">{group.name || t("spending_provider_unset")}</p>
              {groups.size > 1 && <p className="mt-0.5 text-xs text-muted-foreground">
                {group.months.map((index) => monthName(index, true)).join(", ")}
              </p>}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
