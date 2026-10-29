import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Banknote, Plus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { CurrencyFormRow } from "@/components/settings/currencies/CurrencyFormRow";
import { CurrencyListItem } from "@/components/settings/currencies/CurrencyListItem";
import { BulkSettingsActions } from "@/components/settings/shared/BulkSettingsActions";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/contexts/AuthContext";
import { queryKeys } from "@/lib/queryKeys";
import { toast } from "@/lib/toast";
import { currenciesService } from "@/services/currencies";
import { fixerService } from "@/services/fixer";
import { usersService } from "@/services/users";
import type { Currency } from "@/types";

export function CurrenciesTab() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const qc = useQueryClient();

  const [isAdding, setIsAdding] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [newCurrency, setNewCurrency] = useState({
    name: "",
    code: "",
    symbol: "",
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingData, setEditingData] = useState({
    name: "",
    code: "",
    symbol: "",
  });
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const { data: currencies = [], isLoading } = useQuery({
    queryKey: queryKeys.currencies.all(user?.id ?? ""),
    queryFn: () => currenciesService.list(user!.id),
    enabled: !!user?.id,
  });

  // Needed to auto-refresh rates when main currency changes
  const { data: fixerSettings } = useQuery({
    queryKey: ["exchange-status"],
    queryFn: () => fixerService.getStatus(),
    enabled: !!user?.id,
  });

  const createMut = useMutation({
    mutationFn: (data: Partial<Currency>) => currenciesService.create(user!.id, data),
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: queryKeys.currencies.all(user?.id ?? ""),
      });
      setNewCurrency({ name: "", code: "", symbol: "" });
      setIsAdding(false);
      toast.success(t("success_create"));
    },
    onError: () => toast.error(t("error")),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Currency> }) =>
      currenciesService.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: queryKeys.currencies.all(user?.id ?? ""),
      });
      setEditingId(null);
      toast.success(t("success_update"));
    },
    onError: () => toast.error(t("error")),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => currenciesService.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: queryKeys.currencies.all(user?.id ?? ""),
      });
      toast.success(t("success_delete"));
    },
    onError: () => toast.error(t("error")),
  });

  const handleAdd = () => {
    if (!newCurrency.code.trim()) return;
    createMut.mutate(newCurrency);
  };

  const handleUpdate = (id: string) => {
    if (!editingData.code.trim()) return;
    updateMut.mutate({ id, data: editingData });
  };

  const setMainCurrency = async (id: string) => {
    try {
      const mains = currencies.filter((c) => c.is_main);
      for (const cur of mains) {
        await currenciesService.update(cur.id, { is_main: false });
      }
      await currenciesService.update(id, { is_main: true });
      // Keep user.main_currency in sync so backend rate normalization uses correct base
      await usersService.update(user!.id, { main_currency: id });
      qc.invalidateQueries({
        queryKey: queryKeys.currencies.all(user?.id ?? ""),
      });
      toast.success(t("success_update"));

      // Rates are relative to the main currency — auto-refresh when base changes
      if (fixerSettings?.enabled && fixerSettings.api_key_configured) {
        fixerService
          .updateRates()
          .then(() =>
            qc.invalidateQueries({
              queryKey: queryKeys.currencies.all(user?.id ?? ""),
            }),
          )
          .catch(() => {});
      }
    } catch {
      toast.error(t("error"));
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-start justify-end">
        {!isAdding && (
          <Button onClick={() => setIsAdding(true)} className="rounded-xl">
            <Plus className="w-4 h-4 mr-2" />
            {t("add")}
          </Button>
        )}
      </div>

      <Separator />
      <BulkSettingsActions
        items={currencies
          .filter((currency) => !currency.is_main)
          .map((currency) => ({
            id: currency.id,
            label: currency.code,
            values: { name: currency.name, code: currency.code, symbol: currency.symbol },
          }))}
        fields={[
          { key: "code", label: t("currency_code_placeholder"), required: true },
          { key: "symbol", label: t("currency_symbol_placeholder") },
          { key: "name", label: t("currency_name_placeholder") },
        ]}
        selected={selected}
        onSelect={setSelected}
        onUpdate={(id, data) => currenciesService.update(id, data)}
        onDelete={(id) => currenciesService.delete(id)}
        onChanged={() => {
          void qc.invalidateQueries();
        }}
      />

      <div className="settings-item-grid">
        {isAdding && (
          <CurrencyFormRow
            code={newCurrency.code}
            symbol={newCurrency.symbol}
            name={newCurrency.name}
            autoFocusCode
            onCodeChange={(value) => setNewCurrency({ ...newCurrency, code: value })}
            onSymbolChange={(value) => setNewCurrency({ ...newCurrency, symbol: value })}
            onNameChange={(value) => setNewCurrency({ ...newCurrency, name: value })}
            onSubmit={handleAdd}
            onCancel={() => setIsAdding(false)}
          />
        )}

        {isLoading ? (
          <div className="contents">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 rounded-2xl bg-muted/50 animate-pulse" />
            ))}
          </div>
        ) : currencies.length === 0 && !isAdding ? (
          <div className="col-span-full text-center py-12 border border-dashed rounded-3xl text-muted-foreground">
            <Banknote className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p>{t("no_currencies")}</p>
          </div>
        ) : (
          currencies.map((cur) =>
            editingId === cur.id ? (
              <div
                key={cur.id}
                className={`min-w-0 rounded-2xl border transition-colors group ${
                  cur.is_main ? "bg-primary/5 border-primary/20 shadow-sm" : "bg-card "
                }`}
              >
                <div className="w-full">
                  <CurrencyFormRow
                    code={editingData.code}
                    symbol={editingData.symbol}
                    name={editingData.name}
                    autoFocusCode
                    onCodeChange={(value) => setEditingData({ ...editingData, code: value })}
                    onSymbolChange={(value) => setEditingData({ ...editingData, symbol: value })}
                    onNameChange={(value) => setEditingData({ ...editingData, name: value })}
                    onSubmit={() => handleUpdate(cur.id)}
                    onCancel={() => setEditingId(null)}
                  />
                </div>
              </div>
            ) : (
              <CurrencyListItem
                key={cur.id}
                currency={cur}
                selected={selected.has(cur.id)}
                onSelect={() =>
                  setSelected((current) => {
                    const next = new Set(current);
                    if (next.has(cur.id)) next.delete(cur.id);
                    else next.add(cur.id);
                    return next;
                  })
                }
                onSetMain={() => setMainCurrency(cur.id)}
                onEdit={() => {
                  setEditingId(cur.id);
                  setEditingData({
                    code: cur.code,
                    symbol: cur.symbol,
                    name: cur.name,
                  });
                }}
                onDelete={() => {
                  setPendingDeleteId(cur.id);
                }}
              />
            ),
          )
        )}
      </div>

      <ConfirmDialog
        open={!!pendingDeleteId}
        onOpenChange={(open) => {
          if (!open) setPendingDeleteId(null);
        }}
        title={t("delete")}
        description={t("confirm_delete")}
        onConfirm={() => {
          if (!pendingDeleteId) return;
          deleteMut.mutate(pendingDeleteId);
          setPendingDeleteId(null);
        }}
      />
    </div>
  );
}
