import { useTranslation } from "react-i18next";

import { PersonalNotificationSettings } from "@/components/settings/notifications/PersonalNotificationSettings";
import { useAuth } from "@/contexts/AuthContext";

export function NotificationsTab() {
  const { t } = useTranslation();
  const { user } = useAuth();
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">{t("notification_channels")}</h2>
      <p className="text-sm text-muted-foreground">{t("admin_channels_personal_hint")}</p>
      <PersonalNotificationSettings key={user?.id} />
    </div>
  );
}
