import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

import {
  getSettingsPageMenuItems,
  SERVER_SETTINGS_TABS,
  SETTINGS_TAB_COMPONENTS,
  type SettingsTabKey,
} from "@/components/settings/settingsPage.config";
import { SidebarTabsLayout } from "@/components/ui/SidebarTabsLayout";
import { useAuth } from "@/contexts/AuthContext";
import { settingsRoute } from "@/routes";

const ADMIN_TABS: Record<string, string> = {
  api_key: "api",
  exchange_rates: "api",
  registration: "registration",
  smtp: "channels",
  oidc: "oidc",
  maintenance: "maintenance",
};

export function SettingsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const search = settingsRoute.useSearch();
  const adminTab =
    isAdmin && search.tab === "notifications" ? "channels" : ADMIN_TABS[search.tab ?? ""];
  useEffect(() => {
    if (!adminTab) return;
    if (isAdmin) navigate({ to: "/admin", search: { tab: adminTab }, replace: true });
    else navigate({ to: "/settings", search: { tab: "profile" }, replace: true });
  }, [adminTab, isAdmin, navigate]);
  // Keep old links on their merged tabs with the correct menu selection.
  const requestedTab = (
    search.tab === "theme"
      ? "display"
      : search.tab === "2fa" || search.tab === "registration"
        ? "security"
        : search.tab === "smtp"
          ? "notifications"
          : (search.tab ?? "profile")
  ) as SettingsTabKey;
  const activeTab =
    !isAdmin && SERVER_SETTINGS_TABS.includes(requestedTab) ? "profile" : requestedTab;
  const menuItems = getSettingsPageMenuItems(t, isAdmin);
  const setActiveTab = (tab: SettingsTabKey) =>
    navigate({ to: "/settings", search: { tab }, replace: true });
  const ActiveComponent = SETTINGS_TAB_COMPONENTS[activeTab] ?? SETTINGS_TAB_COMPONENTS.profile;

  if (isAdmin && search.tab === "notifications") return null;

  return (
    <SidebarTabsLayout
      title={t("settings")}
      items={menuItems}
      activeValue={activeTab}
      onValueChange={setActiveTab}
    >
      <ActiveComponent />
    </SidebarTabsLayout>
  );
}
