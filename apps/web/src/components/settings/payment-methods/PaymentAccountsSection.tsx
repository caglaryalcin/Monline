import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Edit2, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/lib/toast";
import { paymentAccountsService } from "@/services/paymentAccounts";

export function PaymentAccountsSection() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [draft, setDraft] = useState({ id: "", name: "" });
  const [deleting, setDeleting] = useState<string | null>(null);
  const query = useQuery({
    queryKey: ["payment_accounts", user?.id],
    queryFn: () => paymentAccountsService.list(user!.id),
    enabled: !!user?.id,
  });
  const mutation = useMutation({
    mutationFn: async (
      action: { type: "save"; id: string; name: string } | { type: "delete"; id: string },
    ) => {
      if (action.type === "delete") {
        await paymentAccountsService.delete(action.id);
        return;
      }
      if (action.id) await paymentAccountsService.update(action.id, action.name);
      else await paymentAccountsService.create(user!.id, action.name);
    },
    onSuccess: () => {
      setDraft({ id: "", name: "" });
      setDeleting(null);
      void qc.invalidateQueries({ queryKey: ["payment_accounts", user?.id] });
      void qc.invalidateQueries({ queryKey: ["subscriptions", user?.id] });
      toast.success(t("success"));
    },
    onError: () => toast.error(t("error")),
  });
  return (
    <section className="space-y-4 border-t pt-6">
      <h3 className="text-lg font-semibold">{t("payment_accounts")}</h3>
      <p className="text-sm text-muted-foreground">{t("payment_accounts_help")}</p>
      <form
        className="flex flex-wrap gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (user && draft.name.trim())
            mutation.mutate({ type: "save", id: draft.id, name: draft.name.trim() });
        }}
      >
        <Input
          className="min-w-48 flex-1"
          aria-label={t("payment_account_name")}
          placeholder={t("payment_account_name")}
          maxLength={255}
          value={draft.name}
          onChange={(event) => setDraft({ ...draft, name: event.target.value })}
          disabled={mutation.isPending}
          required
        />
        <Button type="submit" disabled={!user || mutation.isPending || !draft.name.trim()}>
          {t(draft.id ? "save" : "add")}
        </Button>
        {draft.id && (
          <Button
            type="button"
            variant="outline"
            onClick={() => setDraft({ id: "", name: "" })}
            disabled={mutation.isPending}
          >
            {t("cancel")}
          </Button>
        )}
      </form>
      {query.isPending ? (
        <p role="status">{t("loading")}</p>
      ) : query.isError ? (
        <p role="alert">
          {t("error")}{" "}
          <Button variant="outline" onClick={() => void query.refetch()}>
            {t("retry")}
          </Button>
        </p>
      ) : (
        <ul className="space-y-2">
          {query.data.map((account) => (
            <li key={account.id} className="flex items-center gap-3 rounded-xl border p-3">
              <span className="min-w-0 flex-1 break-words">{account.name}</span>
              <Button
                size="icon"
                variant="ghost"
                aria-label={`${t("edit")} · ${account.name}`}
                disabled={mutation.isPending}
                onClick={() => setDraft({ id: account.id, name: account.name })}
              >
                <Edit2 className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                aria-label={`${t("delete")} · ${account.name}`}
                disabled={mutation.isPending}
                onClick={() => setDeleting(account.id)}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        title={t("delete")}
        description={t("payment_account_delete_help")}
        onConfirm={() => {
          if (deleting && !mutation.isPending) mutation.mutate({ type: "delete", id: deleting });
        }}
      />
    </section>
  );
}
