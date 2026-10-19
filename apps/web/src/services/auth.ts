import { api } from "@/lib/api";
import client from "@/lib/client";
import type { User } from "@/types";

interface TotpLoginChallengeResponse {
  challenge: string;
  expires_at: string;
  user_id: string;
}

export interface TotpLoginChallenge {
  challenge: string;
  expiresAt: string;
  userId: string;
}

interface TotpLoginVerifyResponse {
  token: string;
  record: User;
  remember?: boolean;
}

export class TotpRequiredError extends Error {
  challenge: TotpLoginChallenge;

  constructor(challenge: TotpLoginChallenge) {
    super("TOTP_REQUIRED");
    this.name = "TotpRequiredError";
    this.challenge = challenge;
  }
}

export function isTotpRequiredError(error: unknown): error is TotpRequiredError {
  return error instanceof TotpRequiredError;
}

export const authService = {
  isValid: () => client.authStore.isValid,

  getToken: () => client.authStore.token,

  getModel: () => client.authStore.model as User | null,

  clear: () => client.authStore.clear(),

  saveSession: (token: string, record: User, remember = false) =>
    client.authStore.save(token, record, remember),

  onChange: (callback: (token: string, model: unknown) => void, fireImmediately?: boolean) => {
    return client.authStore.onChange(callback, fireImmediately);
  },

  loginWithPassword: async (email: string, password: string, remember = false) => {
    const response = await api.post<TotpLoginVerifyResponse | TotpLoginChallengeResponse>(
      "/api/auth/login",
      { identity: email, password, remember },
    );
    if ("challenge" in response) {
      throw new TotpRequiredError({
        challenge: response.challenge,
        expiresAt: response.expires_at,
        userId: response.user_id,
      });
    }
    client.authStore.save(response.token, response.record, response.remember === true);
    return response;
  },

  completeTotpLoginChallenge: (challenge: string, code: string, remember = false) =>
    api.post<TotpLoginVerifyResponse>("/api/auth/totp/login-verify", { challenge, code, remember }),

  refresh: async (signal?: AbortSignal) => {
    const previousToken = client.authStore.token;
    const response = await api.post<TotpLoginVerifyResponse>("/api/auth/refresh", undefined, {
      signal,
    });
    if (!signal?.aborted && client.authStore.token === previousToken)
      client.authStore.save(response.token, response.record, response.remember === true);
    return response;
  },

  restoreSession: async (signal?: AbortSignal) => {
    try {
      return await api.post<TotpLoginVerifyResponse>("/api/auth/refresh", undefined, { signal });
    } catch (error) {
      if (error && typeof error === "object" && "status" in error && error.status === 401)
        return null;
      throw error;
    }
  },

  register: (data: {
    username: string;
    name: string;
    email: string;
    password: string;
    passwordConfirm: string;
    language?: string;
  }) => client.collection("users").create<User>(data),

  requestPasswordReset: (email: string) => api.post("/api/auth/password-reset", { email }),
};
