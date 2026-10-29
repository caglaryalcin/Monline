import { api } from "@/lib/api";

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  created: string;
  verified: boolean;
  disabled: boolean;
  is_admin: boolean;
  totp_enabled: boolean;
  oidc_linked: boolean;
  subscription_count: number;
  session_count: number;
}

export interface AdminUserInput {
  name: string;
  email: string;
  password?: string;
  verified: boolean;
  disabled: boolean;
}
export type AdminAccountOption = Pick<AdminUser, "id" | "name" | "email" | "disabled">;

export interface AdminUsersPage {
  items: AdminUser[];
  page: number;
  perPage: number;
  totalItems: number;
  totalPages: number;
  totalAccounts: number;
  disabledAccounts: number;
}

export const adminUsersKeys = {
  all: ["admin-users"] as const,
  list: (search: string, page: number, perPage = 25) =>
    ["admin-users", search, page, perPage] as const,
};

export const adminUsersService = {
  options: () => api.get<AdminAccountOption[]>("/api/admin/users/options"),
  list: (search: string, page: number, signal?: AbortSignal, perPage = 25) =>
    api.get<AdminUsersPage>(
      `/api/admin/users?${new URLSearchParams({ q: search, page: String(page), perPage: String(perPage) })}`,
      { signal },
    ),
  create: (data: AdminUserInput) => api.post<AdminUser>("/api/admin/users", data),
  update: (id: string, data: Partial<AdminUserInput>) =>
    api.patch<AdminUser>(`/api/admin/users/${id}`, data),
  revokeSessions: (id: string) => api.post(`/api/admin/users/${id}/revoke-sessions`),
  delete: (id: string) => api.del(`/api/admin/users/${id}`),
};
