import { useTranslation } from "react-i18next";

import { SubscriptionLogo } from "@/components/SubscriptionLogo";
import { validStatementInstallment } from "@/lib/statementAmounts";
import type { ReviewTransaction } from "@/lib/statements";

/** Archived statements are readable records; do not mount an editor for every cell. */
export function StatementSavedRow({
  row,
  outsidePeriod,
  money,
}: {
  row: ReviewTransaction;
  outsidePeriod: boolean;
  money: (amount: number, currency: string) => string;
}) {
  const { t, i18n } = useTranslation();
  return (
    <tr>
      <td className="whitespace-nowrap p-3 align-top tabular-nums">
        <time
          dateTime={row.date}
          title={outsidePeriod ? t("statement_date_outside_period") : undefined}
          className={outsidePeriod ? "text-red-700 dark:text-red-300" : undefined}
        >
          {new Intl.DateTimeFormat(i18n.language.replace("_", "-"), {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
          }).format(new Date(`${row.date}T12:00:00`))}
        </time>
      </td>
      <td className="min-w-64 p-3 align-top">
        <p className="font-medium break-words select-text">{row.merchant}</p>
        {row.category === "digital" && row.subscription_service?.trim() && (
          <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            <span
              aria-hidden="true"
              className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-background"
            >
              <SubscriptionLogo
                sub={{ name: row.subscription_service, url: "" }}
                className="h-full w-full object-contain p-0.5"
              />
            </span>
            {t("statement_subscription")}: {row.subscription_service}
          </p>
        )}
        {row.subscription_match && (
          <p className="mt-1 text-xs text-muted-foreground">
            {t(`statement_match_${row.subscription_match}`)}
          </p>
        )}
        {row.installment && (
          <p className="mt-2 text-xs text-muted-foreground">
            {t("statement_installment")}: {row.installment}
          </p>
        )}
        {!validStatementInstallment(row.installment) && (
          <p role="alert" className="mt-2 text-xs text-destructive">
            {t("statement_installment_invalid")}
          </p>
        )}
        {row.amount_issue && (
          <p role="alert" className="mt-2 text-xs text-destructive">
            {t(`statement_amount_issue_${row.amount_issue}`)}
          </p>
        )}
      </td>
      <td className="whitespace-nowrap p-3 text-right align-top tabular-nums">
        {Number.isFinite(row.amount) ? money(row.amount, row.currency) : "—"}
      </td>
      <td className="p-3 align-top">{row.currency}</td>
      <td className="p-3 align-top">{t(`statement_category_${row.category || "other"}`)}</td>
      <td className="p-3 align-top">
        {t(`statement_kind_${row.kind}`)}
        {row.kind === "repayment" && <p className="mt-1 text-xs text-muted-foreground">{t("statement_repayment_no_calendar")}</p>}
      </td>
      <td className="max-w-64 p-3 align-top text-xs text-muted-foreground">
        {row.source ? (
          <details>
            <summary className="cursor-pointer whitespace-nowrap">
              {t("statement_page", { page: row.page })}
            </summary>
            <p className="mt-2 min-w-48 break-words whitespace-normal select-text">{row.source}</p>
          </details>
        ) : (
          t("statement_page", { page: row.page })
        )}
      </td>
    </tr>
  );
}
