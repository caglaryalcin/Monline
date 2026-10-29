import { useNavigate } from "@tanstack/react-router";
import { Bell, KeyRound, ShieldCheck, UserPlus, Users, Wrench } from "lucide-react";
import { useTranslation } from "react-i18next";

import { AdminUsersTab } from "@/components/admin/AdminUsersTab";
import { NotificationChannelsTab } from "@/components/admin/NotificationChannelsTab";
import { ApiKeyTab } from "@/components/settings/api-keys/ApiKeyTab";
import { FixerTab } from "@/components/settings/exchange-rates/FixerTab";
import { MaintenanceTab } from "@/components/settings/maintenance/MaintenanceTab";
import { OIDCTab } from "@/components/settings/oidc/OIDCTab";
import { RegistrationTab } from "@/components/settings/registration/RegistrationTab";
import { SidebarTabsLayout } from "@/components/ui/SidebarTabsLayout";
import { useAuth } from "@/contexts/AuthContext";
import { adminRoute } from "@/routes";

export function AdminPage() {
  const { t } = useTranslation();
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const search = adminRoute.useSearch();
  const items = [
    { value: "users", label: t("admin_users_title"), icon: Users },
    { value: "registration", label: t("admin_registration_access"), icon: UserPlus },
    { value: "channels", label: t("notification_channels"), icon: Bell },
    { value: "api", label: "API", icon: KeyRound },
    { value: "oidc", label: "OIDC/SSO", icon: ShieldCheck },
    { value: "maintenance", label: t("maintenance"), icon: Wrench },
  ];
  const tab = items.some((item) => item.value === search.tab) ? search.tab! : "users";
  if (!isAdmin) return <p role="alert">{t("admin_users_forbidden")}</p>;
  return (
    <SidebarTabsLayout
      title={t("admin_panel")}
      items={items}
      activeValue={tab}
      onValueChange={(value) => navigate({ to: "/admin", search: { tab: value }, replace: true })}
    >
      {tab === "users" && <AdminUsersTab />}
      {tab === "registration" && (
        <div className="space-y-5">
          <h2 className="text-xl font-semibold">{t("admin_registration_access")}</h2>
          <RegistrationTab />
        </div>
      )}
      {tab === "channels" && (
        <div className="space-y-7">
          <div>
            <h2 className="text-xl font-semibold">{t("notification_channels")}</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("admin_channels_management_hint")}
            </p>
          </div>
          <NotificationChannelsTab />
        </div>
      )}
      {tab === "api" && (
        <div className="space-y-6">
          <h2 className="text-xl font-semibold">API</h2>
          <div className="space-y-8">
            <section className="space-y-4">
              <h3 className="text-lg font-semibold">{t("api_key")}</h3>
              <ApiKeyTab />
            </section>
            <section className="space-y-4 border-t pt-6">
              <h3 className="text-lg font-semibold">{t("fixer_api")}</h3>
              <FixerTab />
            </section>
          </div>
        </div>
      )}
      {tab === "oidc" && <OIDCTab />}
      {tab === "maintenance" && <MaintenanceTab />}
    </SidebarTabsLayout>
  );
}
