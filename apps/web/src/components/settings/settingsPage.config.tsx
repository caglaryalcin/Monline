import type { TFunction } from "i18next";
import {
  Banknote,
  Bell,
  CreditCard,
  Palette,
  Shield,
  Tags,
  Trash2,
  User,
  Users,
} from "lucide-react";
import type { ComponentType } from "react";

import { CategoriesTab } from "@/components/settings/categories/CategoriesTab";
import { CurrenciesTab } from "@/components/settings/currencies/CurrenciesTab";
import { DeleteAccountTab } from "@/components/settings/delete-account/DeleteAccountTab";
import { GroupsTab } from "@/components/settings/groups/GroupsTab";
import { HouseholdTab } from "@/components/settings/household/HouseholdTab";
import { NotificationsTab } from "@/components/settings/notifications/NotificationsTab";
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
  | "groups"
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
  groups: GroupsTab,
  currencies: CurrenciesTab,
  payment_methods: PaymentMethodsTab,
  display: ThemeTab,
  theme: ThemeTab,
  notifications: NotificationsTab,
  delete: DeleteAccountTab,
  // Legacy links redirect in SettingsPage; these entries never expose server controls.
  api_key: ProfileTab,
  exchange_rates: ProfileTab,
  registration: SecurityTab,
  smtp: NotificationsTab,
  oidc: ProfileTab,
  maintenance: ProfileTab,
};

export const SERVER_SETTINGS_TABS: readonly string[] = [
  "api_key",
  "exchange_rates",
  "registration",
  "smtp",
  "oidc",
  "maintenance",
];

export function getSettingsPageMenuItems(
  t: TFunction,
  _canManageServer = false,
): SidebarTabsLayoutItem<SettingsTabKey>[] {
  return [
    { value: "profile", label: t("profile"), icon: User },
    { value: "security", label: t("security"), icon: Shield },
    { value: "notifications", label: t("notifications"), icon: Bell },
    { value: "household", label: t("household"), icon: Users },
    { value: "groups", label: t("sharing_groups"), icon: Users },
    { value: "categories", label: t("categories"), icon: Tags },
    { value: "display", label: t("theme_and_display"), icon: Palette },
    { value: "payment_methods", label: t("payment_methods"), icon: CreditCard },
    { value: "currencies", label: t("currencies"), icon: Banknote },
    { value: "delete", label: t("delete_account"), icon: Trash2, danger: true },
  ];
}
