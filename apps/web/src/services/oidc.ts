import { api } from "@/lib/api";
import { TotpRequiredError } from "@/services/auth";
import type { User } from "@/types";

interface OIDCConfigResponse {
  enabled: boolean;
  provider_name: string;
}

interface OIDCAuthorizeResponse {
  authorization_url: string;
  state: string;
}

interface OIDCCallbackResponse {
  token: string;
  record: User;
  remember?: boolean;
}

export interface OIDCConfig {
  enabled: boolean;
  providerName: string;
}

export interface OIDCAuthorization {
  authorizationUrl: string;
  state: string;
}

export const oidcService = {
  /** Public endpoint — tells the login page whether an SSO provider is ready. */
  getConfig: async (): Promise<OIDCConfig> => {
    const response = await api.get<OIDCConfigResponse>("/api/auth/oidc/config", {
      cache: "no-store",
    });
    return {
      enabled: !!response.enabled,
      providerName: response.provider_name ?? "",
    };
  },

  /** Returns the provider authorization URL plus the state the callback expects. */
  startAuthorization: async (remember = false): Promise<OIDCAuthorization> => {
    const response = await api.get<OIDCAuthorizeResponse>(
      `/api/auth/oidc/authorize?remember=${remember}`,
    );
    return {
      authorizationUrl: response.authorization_url,
      state: response.state,
    };
  },

  completeAuthorization: async (code: string, state: string) => {
    const response = await api.post<
      OIDCCallbackResponse | { challenge: string; expires_at: string; user_id: string }
    >("/api/auth/oidc/callback", { code, state });
    if ("challenge" in response)
      throw new TotpRequiredError({
        challenge: response.challenge,
        expiresAt: response.expires_at,
        userId: response.user_id,
      });
    return response;
  },
};
