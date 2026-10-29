import { useQuery } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";

import { Label } from "@/components/ui/label";
import { ThemedSelect } from "@/components/ui/themed-select";
import { useAuth } from "@/contexts/AuthContext";
import { adminUsersService } from "@/services/adminUsers";

export function AdminAccountScope({ children }: { children: (ownerId: string) => ReactNode }) {
  const { t } = useTranslation();
  const { user, isAdmin } = useAuth();
  const [selected, setSelected] = useState(user?.id ?? "");
  const accounts = useQuery({
    queryKey: ["admin-users", "options"],
    queryFn: adminUsersService.options,
    enabled: isAdmin,
  });
  const ownerId = accounts.data?.some((account) => account.id === selected)
    ? selected
    : (user?.id ?? "");
  return (
    <div className="space-y-6">
      <div className="space-y-2 rounded-2xl border bg-muted/20 p-4">
        <Label htmlFor="admin-config-owner">{t("admin_config_account")}</Label>
        <ThemedSelect
          id="admin-config-owner"
          value={ownerId}
          onChange={(event) => setSelected(event.target.value)}
          disabled={accounts.isPending || accounts.isError}
          className="w-full rounded-xl"
        >
          {(
            accounts.data ?? (user ? [{ id: user.id, name: user.name, email: user.email }] : [])
          ).map((account) => (
            <option key={account.id} value={account.id}>
              {account.name || account.email} · {account.email}
            </option>
          ))}
        </ThemedSelect>
        <p className="text-xs leading-relaxed text-muted-foreground">
          {t("admin_config_account_hint")}
        </p>
        {accounts.isError && (
          <p role="alert" className="text-sm text-destructive">
            {t("admin_users_request_failed")}
          </p>
        )}
      </div>
      {ownerId && !accounts.isError && <div key={ownerId}>{children(ownerId)}</div>}
    </div>
  );
}
