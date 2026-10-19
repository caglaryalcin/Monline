import type { TFunction } from "i18next";
import {
  Banknote,
  Bell,
  CreditCard,
  Key,
  Palette,
  Shield,
  ShieldCheck,
  Tags,
  Trash2,
  TrendingUp,
  User,
  Users,
  Wrench,
} from "lucide-react";
import type { ComponentType } from "react";

import { ApiKeyTab } from "@/components/settings/api-keys/ApiKeyTab";
import { CategoriesTab } from "@/components/settings/categories/CategoriesTab";
import { CurrenciesTab } from "@/components/settings/currencies/CurrenciesTab";
import { DeleteAccountTab } from "@/components/settings/delete-account/DeleteAccountTab";
import { FixerTab } from "@/components/settings/exchange-rates/FixerTab";
import { HouseholdTab } from "@/components/settings/household/HouseholdTab";
import { MaintenanceTab } from "@/components/settings/maintenance/MaintenanceTab";
import { NotificationsTab } from "@/components/settings/notifications/NotificationsTab";
import { OIDCTab } from "@/components/settings/oidc/OIDCTab";
import { PaymentMethodsTab } from "@/components/settings/payment-methods/PaymentMethodsTab";
import { ProfileTab } from "@/components/settings/profile/ProfileTab";
import { SecurityTab } from "@/components/settings/security/SecurityTab";
import { ThemeTab } from "@/components/settings/theme/ThemeTab";
import type { SidebarTabsLayoutItem } from "@/components/ui/SidebarTabsLayout";

export type SettingsTabKey =
  | "profile"
  | "security"
  | "2fa"
  | "categories"
  | "household"
  | "currencies"
  | "payment_methods"
  | "display"
  | "theme"
  | "notifications"
  | "api_key"
  | "exchange_rates"
  | "registration"
  | "smtp"
  | "oidc"
  | "maintenance"
  | "delete";

export const SETTINGS_TAB_COMPONENTS: Record<SettingsTabKey, ComponentType> = {
  profile: ProfileTab,
  security: SecurityTab,
  "2fa": SecurityTab,
  categories: CategoriesTab,
  household: HouseholdTab,
  currencies: CurrenciesTab,
  payment_methods: PaymentMethodsTab,
  display: ThemeTab,
  theme: ThemeTab,
  notifications: NotificationsTab,
  api_key: ApiKeyTab,
  exchange_rates: FixerTab,
  registration: SecurityTab,
  smtp: NotificationsTab,
  oidc: OIDCTab,
  maintenance: MaintenanceTab,
  delete: DeleteAccountTab,
};

export function getSettingsPageMenuItems(
  t: TFunction,
  canManageServer = false,
): SidebarTabsLayoutItem<SettingsTabKey>[] {
  return [
    { value: "profile", label: t("profile"), icon: User },
    { value: "security", label: t("security"), icon: Shield },
    { value: "notifications", label: t("notifications"), icon: Bell },
    { value: "household", label: t("household"), icon: Users },
    { value: "categories", label: t("categories"), icon: Tags },
    { value: "display", label: t("theme_and_display"), icon: Palette },
    {
      value: "payment_methods",
      label: t("payment_methods"),
      icon: CreditCard,
    },
    { value: "currencies", label: t("currencies"), icon: Banknote },
    { value: "api_key", label: t("api_key"), icon: Key },
    {
      value: "exchange_rates",
      label: t("fixer_api"),
      icon: TrendingUp,
    },
    ...serverSettingsItems(t, canManageServer),
    {
      value: "delete",
      label: t("delete_account"),
      icon: Trash2,
      danger: true,
    },
  ];
}

export const SERVER_SETTINGS_TABS: readonly string[] = ["oidc", "maintenance"];

function serverSettingsItems(
  t: TFunction,
  enabled: boolean,
): SidebarTabsLayoutItem<SettingsTabKey>[] {
  return enabled
    ? [
        { value: "oidc", label: "OIDC/SSO", icon: ShieldCheck },
        { value: "maintenance", label: t("maintenance"), icon: Wrench },
      ]
    : [];
}
