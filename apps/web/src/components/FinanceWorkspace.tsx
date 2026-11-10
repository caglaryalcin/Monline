import { Link, useRouterState, useSearch } from "@tanstack/react-router";
import { ArrowLeftRight, FileText, Landmark, LayoutDashboard, PiggyBank } from "lucide-react";
import { type ReactNode, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

import { InfoButton } from "@/components/ui/info-button";
import { FinanceCurrencyContext } from "@/contexts/FinanceCurrencyContext";
import { useFinanceCurrency } from "@/hooks/useFinanceCurrency";
import { FINANCE_SECTIONS, financeWorkspaceSection } from "@/lib/financeWorkspace";
import { cn } from "@/lib/utils";

const icons = { overview: LayoutDashboard, ledger: ArrowLeftRight, debts: Landmark, savings: PiggyBank };

export function FinanceWorkspace({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const active = financeWorkspaceSection(pathname);
  const displaysLedgerCurrency = active === "overview" || active === "ledger";
  const currency = useFinanceCurrency({ convert: displaysLedgerCurrency });
  const statements = pathname.startsWith("/statements");
  const search = useSearch({ strict: false });
  const debtSection = statements ? "statements" : search.tab === "loans" ? "loans" : "installments";
  const content = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (content.current) {
      content.current.scrollTop = 0;
      content.current.scrollLeft = 0;
    }
  }, [pathname]);

  return (
    <FinanceCurrencyContext.Provider value={currency}>
    <section className="flex h-full min-h-0 min-w-0 flex-col gap-5" aria-label={t("finance_workspace")}>
      <div className="shrink-0 border-b pb-4">
        <div className="flex flex-wrap items-center justify-end gap-3">
          <nav aria-label={t("finance_workspace_sections")} className="flex max-w-full flex-wrap gap-1 rounded-xl bg-muted p-1">
            {FINANCE_SECTIONS.map(({ key, path }) => {
              const Icon = icons[key];
              return <Link key={key} to={path} aria-current={active === key ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  active === key ? "bg-background text-foreground shadow-sm ring-1 ring-inset ring-primary/60" : "text-muted-foreground hover:text-foreground",
                )}>
                <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
                {t(`finance_workspace_${key}`)}
              </Link>;
            })}
          </nav>
        </div>
      </div>
      <div ref={content} className="min-h-0 min-w-0 flex-1 overflow-y-auto [scrollbar-gutter:stable]">
        <div className={cn("min-w-0 space-y-4", (active === "ledger" || active === "debts") && "pr-2")}>
          {active === "debts" && <nav aria-label={t("finance_workspace_debt_sections")} className="flex flex-wrap items-center gap-2 text-sm">
            <Link to="/debt" search={{ tab: "loans" }} aria-current={debtSection === "loans" ? "page" : undefined}
              className={cn("rounded-lg px-3 py-1.5 font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", debtSection === "loans" ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>
              {t("spending_section_loans")}
            </Link>
            <Link to="/debt" search={{ tab: "installments" }} aria-current={debtSection === "installments" ? "page" : undefined}
              className={cn("rounded-lg px-3 py-1.5 font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", debtSection === "installments" ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>
              {t("spending_section_installments")}
            </Link>
            <Link to="/statements" aria-current={statements ? "page" : undefined}
              className={cn("flex items-center gap-2 rounded-lg px-3 py-1.5 font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", statements ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>
              <FileText aria-hidden="true" className="h-4 w-4" />{t("bank_statements")}
            </Link>
            {debtSection === "loans" && <InfoButton title={t("loans_calculation")}>
              <p className="mb-2 font-semibold text-foreground">{t("loans_calculation")}</p>
              <p>{t("loans_help")}</p>
            </InfoButton>}
          </nav>}
          {displaysLedgerCurrency && currency.failed && <p role="alert" className="rounded-xl border border-destructive/30 p-4 text-sm text-destructive">
            {t("finance_currency_unavailable", { currency: currency.label })}
          </p>}
          {children}
        </div>
      </div>
    </section>
    </FinanceCurrencyContext.Provider>
  );
}
