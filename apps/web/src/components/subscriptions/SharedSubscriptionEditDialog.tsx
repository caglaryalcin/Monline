import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { formatBillingPeriod } from "@/lib/billingPeriods";
import { queryKeys } from "@/lib/queryKeys";
import { isCredit } from "@/lib/recordTypes";
import { sharingErrorMessage } from "@/lib/sharingErrors";
import { toast } from "@/lib/toast";
import { cyclesService } from "@/services/cycles";
import type { SharedSubscription } from "@/services/sharing";
import { sharingKeys, sharingService } from "@/services/sharing";

export function SharedSubscriptionEditDialog({
  sub,
  userId,
  onClose,
}: {
  sub: SharedSubscription;
  userId: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: sub.name,
    price: String(sub.price),
    cycle: sub.cycle,
    frequency: String(sub.frequency),
    next_payment: sub.next_payment.slice(0, 10),
    auto_renew: sub.auto_renew,
    inactive: sub.inactive,
    notes: sub.notes ?? "",
    payer: sub.payer ?? "",
  });
  const cycles = useQuery({ queryKey: queryKeys.cycles(), queryFn: cyclesService.list });
  const payers = useQuery({
    queryKey: sharingKeys.payers(userId, sub.id),
    queryFn: () => sharingService.payers(sub.id),
    staleTime: 0,
    refetchOnWindowFocus: "always",
  });
  const credit = isCredit(sub);
  const finite = (sub.payment_limit ?? 0) > 0 || !!sub.end_date;
  const save = useMutation({
    mutationFn: () => {
      const { payer, ...fields } = form;
      return sharingService.updateShared(sub.id, {
        ...fields,
        ...(payer === (sub.payer ?? "") ? {} : { payer }),
        price: Number(form.price),
        frequency: Number(form.frequency),
      });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: sharingKeys.shared(userId) });
      qc.invalidateQueries({ queryKey: sharingKeys.payers(userId, sub.id) });
      qc.invalidateQueries({ queryKey: queryKeys.subscriptions.all(userId) });
      qc.invalidateQueries({ queryKey: queryKeys.household.all(userId) });
      toast.success(t("success"));
      onClose();
    },
    onError: (error: Error) => {
      toast.error(sharingErrorMessage(t, error));
      qc.invalidateQueries({ queryKey: sharingKeys.shared(userId) });
    },
  });
  return (
    <Dialog open onOpenChange={(open) => !open && !save.isPending && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {t("edit")} · {sub.name}
          </DialogTitle>
          <DialogDescription>{t("sharing_edit_hint")}</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!save.isPending) save.mutate();
          }}
        >
          <fieldset className="space-y-4" disabled={save.isPending}>
            <div className="space-y-2">
              <Label htmlFor="shared-name">{t("name")}</Label>
              <Input
                id="shared-name"
                value={form.name}
                maxLength={255}
                required
                onChange={(event) =>
                  setForm((current) => ({ ...current, name: event.target.value }))
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="shared-price">{t("price")}</Label>
                <Input
                  id="shared-price"
                  type="number"
                  min="0"
                  step="any"
                  required
                  value={form.price}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, price: event.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="shared-currency">{t("currency")}</Label>
                <Input id="shared-currency" readOnly value={sub.expand?.currency?.code ?? ""} />
              </div>
            </div>
            {!credit && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="shared-cycle">{t("billing_cycle")}</Label>
                  <Select
                    value={form.cycle}
                    onValueChange={(cycle) => setForm((current) => ({ ...current, cycle }))}
                    disabled={cycles.isPending || cycles.isError || save.isPending}
                  >
                    <SelectTrigger id="shared-cycle">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {cycles.data
                        ?.filter((cycle) => cycle.name !== "One-Time")
                        .map((cycle) => (
                          <SelectItem key={cycle.id} value={cycle.id}>
                            {formatBillingPeriod(t, cycle.name, 1)}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="shared-frequency">{t("frequency")}</Label>
                  <Input
                    id="shared-frequency"
                    type="number"
                    min="1"
                    step="1"
                    required
                    value={form.frequency}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, frequency: event.target.value }))
                    }
                  />
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="shared-payer">{t("payer")}</Label>
              <Select
                value={form.payer || "__none__"}
                disabled={payers.isPending || payers.isError || save.isPending}
                onValueChange={(value) =>
                  setForm((current) => ({ ...current, payer: value === "__none__" ? "" : value }))
                }
              >
                <SelectTrigger id="shared-payer" aria-describedby="shared-payer-hint">
                  <SelectValue placeholder={t("sharing_payer_unspecified")}>
                    {form.payer &&
                    payers.isSuccess &&
                    !payers.data.some((payer) => payer.value === form.payer)
                      ? t("household_payer_unavailable")
                      : undefined}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">{t("sharing_payer_unspecified")}</SelectItem>
                  {payers.data?.map((payer) => (
                    <SelectItem key={payer.value} value={payer.value}>
                      {payer.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p id="shared-payer-hint" className="text-xs leading-relaxed text-muted-foreground">
                {t("sharing_payer_hint")}
              </p>
              {payers.isError && (
                <p role="alert" className="text-xs text-destructive">
                  {sharingErrorMessage(t, payers.error)}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="shared-date">{t(credit ? "received_on" : "next_payment")}</Label>
              <Input
                id="shared-date"
                type="date"
                required
                max={sub.end_date?.slice(0, 10) || undefined}
                value={form.next_payment}
                onChange={(event) =>
                  setForm((current) => ({ ...current, next_payment: event.target.value }))
                }
              />
            </div>
            {!credit && (
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="shared-auto-renew">{t("auto_renew")}</Label>
                <Switch
                  id="shared-auto-renew"
                  checked={finite || form.auto_renew}
                  disabled={finite || save.isPending}
                  onCheckedChange={(auto_renew) =>
                    setForm((current) => ({ ...current, auto_renew }))
                  }
                />
              </div>
            )}
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="shared-active">{t("active")}</Label>
              <Switch
                id="shared-active"
                checked={!form.inactive}
                disabled={save.isPending}
                onCheckedChange={(active) =>
                  setForm((current) => ({ ...current, inactive: !active }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="shared-notes">{t("notes")}</Label>
              <Textarea
                id="shared-notes"
                value={form.notes}
                onChange={(event) =>
                  setForm((current) => ({ ...current, notes: event.target.value }))
                }
              />
            </div>
          </fieldset>
          {save.isError && (
            <p role="alert" className="text-sm text-destructive">
              {sharingErrorMessage(t, save.error)}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={save.isPending}>
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={save.isPending || !form.name.trim()}>
              {t("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
