import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { useAuth } from "@/contexts/AuthContext";
import { queryKeys } from "@/lib/queryKeys";
import { toast } from "@/lib/toast";
import { notificationsService } from "@/services/notifications";
import type { NotificationsConfig } from "@/types";

export function useNotificationPreferences() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const qc = useQueryClient();
  const queryKey = queryKeys.notificationsConfig(user?.id ?? "");
  const config = useQuery({
    queryKey,
    queryFn: () => notificationsService.getConfig(user!.id),
    enabled: !!user?.id,
  });
  const save = useMutation({
    mutationFn: (data: Partial<NotificationsConfig>) =>
      config.data?.id
        ? notificationsService.updateConfig(config.data.id, data)
        : notificationsService.createConfig({ ...data, user: user!.id }),
    onSuccess: (record) => {
      qc.setQueryData<NotificationsConfig>(queryKey, (current) => ({ ...current, ...record }));
      toast.success(t("saved"));
    },
    onError: (error: Error) => toast.error(t(error.message, { defaultValue: t("error") })),
  });
  return { config, save };
}
