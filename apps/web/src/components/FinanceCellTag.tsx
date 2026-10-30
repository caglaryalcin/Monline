import { Portal as TooltipPortal } from "@radix-ui/react-tooltip";
import { BadgeCheck, CreditCard, Link2, TriangleAlert } from "lucide-react";

import { FinanceCardPaymentComparison } from "@/components/FinanceCardPaymentComparison";
import { StatementLink } from "@/components/StatementLink";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { CardPaymentCheck } from "@/lib/finance";

export function FinanceCellTag({
  type,
  label,
  description,
  statementId,
  inline = false,
  paymentCheck,
}: {
  label: string;
  description?: string;
  inline?: boolean;
  paymentCheck?: CardPaymentCheck;
} & ({ type: "card"; statementId?: never } | { type: "statement"; statementId: string })) {
  const Icon = type === "card" ? CreditCard
    : paymentCheck?.status === "matched" ? BadgeCheck
      : paymentCheck?.status === "mismatch" ? TriangleAlert : Link2;
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          {type === "statement" ? (
            <StatementLink
              statementId={statementId}
              aria-label={label}
              className="finance-sheet__statement-link"
              data-payment-check={paymentCheck?.status}
            >
              <Icon aria-hidden="true" className="h-3 w-3" />
            </StatementLink>
          ) : (
            <span
              role="img"
              aria-label={label}
              tabIndex={0}
              className="finance-sheet__payment-tag"
              style={inline ? { position: "static", width: 20, height: 20 } : undefined}
            >
              <Icon aria-hidden="true" className="h-3 w-3" />
              <span className="sr-only">{label}</span>
            </span>
          )}
        </TooltipTrigger>
        <TooltipPortal>
          <TooltipContent side="top" className="max-w-sm text-xs">
            {paymentCheck ? <FinanceCardPaymentComparison check={paymentCheck} compact />
              : description ? <p>{description}</p> : <p className="font-medium">{label}</p>}
          </TooltipContent>
        </TooltipPortal>
      </Tooltip>
    </TooltipProvider>
  );
}
