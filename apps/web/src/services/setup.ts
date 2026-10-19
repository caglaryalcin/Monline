import { api } from "@/lib/api";
import type { User } from "@/types";

export interface SetupConfiguration {
  username: string;
  email: string;
  password: string;
  passwordConfirm: string;
  language: string;
  currency: string;
  budget: number;
  darkThemeMode: number;
  openRegistrations: boolean;
  serverUrl: string;
  smtp: {
    enabled: boolean;
    host: string;
    port: number;
    username: string;
    password: string;
    senderAddress: string;
    senderName: string;
    tls: boolean;
  };
}

export const setupService = {
  status: () => api.get<{ hasUsers: boolean }>("/api/auth/bootstrap-status", { cache: "no-store" }),
  restore: (file: File) => {
    const body = new FormData();
    body.append("file", file);
    return api.postForm<{ message: string }>("/api/auth/setup/restore", body, {
      timeoutMs: 600_000,
    });
  },
  complete: (configuration: SetupConfiguration) =>
    api.post<{ token: string; record: User }>("/api/auth/setup", configuration),
  testSmtp: (configuration: Pick<SetupConfiguration, "email" | "smtp" | "language">) =>
    api.post<{ message: string }>("/api/auth/setup/smtp-test", configuration, {
      timeoutMs: 60_000,
    }),
};
