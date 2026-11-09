import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { CurrencyInput } from "@/components/ui/currency-input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { dialogDismissHandler } from "@/lib/dialogDismiss";
import { type LoanSummary, type SpendingData, spendingKey } from "@/lib/spending";
import { loansService } from "@/services/loans";

export function LoanPrincipalDialog({ loan, onClose }: { loan: LoanSummary; onClose: () => void }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [amount, setAmount] = useState<number | null>(loan.principal_amount ?? null);
  const valid =
    amount !== null &&
    Number.isFinite(amount) &&
    amount > 0 &&
    amount <= 1e12 &&
    Math.abs(amount * 100 - Math.round(amount * 100)) < 0.01;
  const invalid = amount !== null && !valid;
  const mutation = useMutation({
    mutationFn: (value: number | null) => loansService.savePrincipal(loan.row_id, value),
    onSuccess: async (result) => {
      queryClient.setQueryData<SpendingData>(spendingKey(userId), (data) =>
        data
          ? {
              ...data,
              loans: data.loans?.map((item) =>
                item.row_id === loan.row_id
                  ? { ...item, principal_amount: result.principal_amount }
                  : item,
              ),
            }
          : data,
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: spendingKey(userId) }),
        queryClient.invalidateQueries({ queryKey: ["finance", userId] }),
      ]);
      onClose();
    },
  });

  return (
    <Dialog open onOpenChange={dialogDismissHandler(onClose, mutation.isPending)}>
      <DialogContent
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          inputRef.current?.focus();
        }}
      >
        <DialogHeader>
          <DialogTitle>{t("loans_principal_amount")}</DialogTitle>
          <DialogDescription>
            <span className="mb-1 block font-medium text-foreground">{loan.name}</span>
            {t("loans_principal_help")}
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          aria-busy={mutation.isPending}
          onSubmit={(event) => {
            event.preventDefault();
            if (valid && !mutation.isPending) mutation.mutate(amount);
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="loan-principal-amount">{t("loans_principal_amount")}</Label>
            <CurrencyInput
              ref={inputRef}
              id="loan-principal-amount"
              code={loan.currency}
              value={amount}
              onChange={setAmount}
              onEmpty={() => setAmount(null)}
              disabled={mutation.isPending}
              aria-invalid={invalid}
              aria-describedby={invalid ? "loan-principal-error" : undefined}
            />
            {invalid && (
              <p id="loan-principal-error" role="alert" className="text-xs text-destructive">
                {t("loans_principal_invalid")}
              </p>
            )}
          </div>
          {mutation.isError && (
            <p role="alert" className="text-sm text-destructive">
              {t(
                mutation.error.message === "loans_principal_invalid"
                  ? "loans_principal_invalid"
                  : "loans_principal_save_failed",
              )}
            </p>
          )}
          <div className="flex flex-wrap items-center justify-end gap-2">
            {loan.principal_amount != null && (
              <Button
                type="button"
                variant="ghost"
                className="mr-auto text-destructive"
                disabled={mutation.isPending}
                onClick={() => mutation.mutate(null)}
              >
                {t("loans_principal_clear")}
              </Button>
            )}
            <Button type="button" variant="outline" disabled={mutation.isPending} onClick={onClose}>
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={!valid || mutation.isPending}>
              {t("save")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
