import { api } from "@/lib/api";
import type { Subscription } from "@/types";

export interface SharingUser {
  id: string;
  name: string;
  email: string;
  status?: "active" | "pending";
}

export interface SharingGroup {
  id: string;
  name: string;
  members: SharingUser[];
  pendingMembers?: SharingUser[];
  invitation_delivery_failures?: number;
}

export interface SubscriptionAccess {
  users: SharingUser[];
  groups: string[];
  groupPermissions: Record<string, SharingPermission>;
  groupEnabled?: Record<string, boolean>;
  userPermissions?: Record<string, SharingPermission>;
  is_shared: boolean;
  enabled?: boolean;
  pending_count?: number;
  invitation_delivery_failures?: number;
}

export type SharingPermission = "read" | "edit";
export type SharedSubscription = Subscription & {
  owner_name: string;
  permission: SharingPermission;
};
export interface SharedPayerOption {
  value: string;
  name: string;
}
export type SharedSubscriptionEdit = Pick<
  Subscription,
  | "name"
  | "price"
  | "cycle"
  | "frequency"
  | "next_payment"
  | "auto_renew"
  | "inactive"
  | "notes"
  | "payer"
>;

export const sharingService = {
  groups: () => api.get<SharingGroup[]>("/api/sharing/groups"),
  saveGroup: (id: string | null, name: string, memberEmails: string[]) =>
    id
      ? api.put<SharingGroup>(`/api/sharing/groups/${id}`, { name, memberEmails })
      : api.post<SharingGroup>("/api/sharing/groups", { name, memberEmails }),
  deleteGroup: (id: string) => api.del(`/api/sharing/groups/${id}`),
  access: (id: string) => api.get<SubscriptionAccess>(`/api/sharing/subscriptions/${id}`),
  setEnabled: (id: string, enabled: boolean) =>
    api.patch<SubscriptionAccess>(`/api/sharing/subscriptions/${id}/enabled`, { enabled }),
  saveAccess: (
    id: string,
    userEmails: string[],
    groupIds: string[],
    groupPermissions: Record<string, SharingPermission>,
    userPermissions: Record<string, SharingPermission> = {},
    groupEnabled?: Record<string, boolean>,
  ) =>
    api.put<SubscriptionAccess>(`/api/sharing/subscriptions/${id}`, {
      userEmails,
      groupIds,
      groupPermissions,
      userPermissions,
      ...(groupEnabled !== undefined ? { groupEnabled } : {}),
    }),
  shared: () => api.get<SharedSubscription[]>("/api/sharing/shared-subscriptions"),
  payers: (id: string) => api.get<SharedPayerOption[]>(`/api/sharing/subscriptions/${id}/payers`),
  updateShared: (id: string, data: SharedSubscriptionEdit) =>
    api.patch<{ id: string }>(`/api/sharing/shared-subscriptions/${id}`, data),
};

export const sharingKeys = {
  groups: (userId: string) => ["sharing-groups", userId] as const,
  access: (userId: string, id: string) => ["subscription-access", userId, id] as const,
  shared: (userId: string) => ["shared-subscriptions", userId] as const,
  payers: (userId: string, id: string) => ["shared-subscription-payers", userId, id] as const,
};

export const parseSharingEmails = (text: string) => [
  ...new Set(
    text
      .split(/[,;\s]+/)
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  ),
];
