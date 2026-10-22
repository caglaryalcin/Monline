import { api } from "@/lib/api";
import client from "@/lib/client";
import type { AdminSettings } from "@/types";

export interface DatabaseMaintenanceResult {
  action: "check" | "optimize";
  ok: boolean;
  before: { databaseBytes: number; walBytes: number; logicalBytes: number; freeBytes: number };
  after: { databaseBytes: number; walBytes: number; logicalBytes: number; freeBytes: number };
  safetyBackup: string | null;
  checkpointBusy?: boolean;
}

export const serverSettingsService = {
  // ─── Settings ───────────────────────────────────────────────────────────────

  getSettings: () => api.get<AdminSettings>("/api/admin/settings"),

  updateSettings: (data: Partial<AdminSettings>) =>
    api.patch<AdminSettings>("/api/admin/settings", data),

  // ─── SMTP ───────────────────────────────────────────────────────────────────

  getSmtp: () => api.get<Record<string, unknown>>("/api/admin/smtp"),

  updateSmtp: (data: Record<string, unknown>) => api.post("/api/admin/smtp", data),

  testSmtp: () => api.post("/api/admin/smtp/test"),

  // ─── Backup / Restore ───────────────────────────────────────────────────────

  /** Returns a Response so callers can handle the binary blob themselves. */
  backupRaw: (password: string) =>
    fetch("/api/db/backup", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${client.authStore.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ password }),
    }),

  restore: (formData: FormData) =>
    api.postForm("/api/db/restore", formData, { timeoutMs: 600_000 }),

  // ─── Maintenance ────────────────────────────────────────────────────────────

  deleteUnusedLogos: () => api.post<{ deleted: number }>("/api/admin/deleteunusedlogos"),

  maintainDatabase: (action: "check" | "optimize") =>
    api.post<DatabaseMaintenanceResult>(
      "/api/admin/database-maintenance",
      { action },
      { timeoutMs: 600_000 },
    ),
};
