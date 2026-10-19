import type { User } from "@/types";

vi.mock("@/lib/api", () => ({ api: { post: vi.fn() } }));
vi.mock("@/lib/client", () => ({
  default: {
    authStore: {
      isValid: true,
      token: "token-1",
      model: { id: "user-1" },
      clear: vi.fn(),
      save: vi.fn(),
      onChange: vi.fn(),
    },
    collection: vi.fn(),
  },
}));
import { api } from "@/lib/api";
import client from "@/lib/client";

import { authService, isTotpRequiredError, TotpRequiredError } from "./auth";

describe("authService", () => {
  beforeEach(() => vi.clearAllMocks());
  it("preserves session-store subscriptions", () => {
    const unsubscribe = vi.fn();
    vi.mocked(client.authStore.onChange).mockReturnValue(unsubscribe);
    expect(authService.isValid()).toBe(true);
    expect(authService.getToken()).toBe("token-1");
    expect(authService.getModel()).toEqual({ id: "user-1" });
    authService.saveSession("token-2", { id: "user-2" } as User);
    authService.clear();
    expect(client.authStore.save).toHaveBeenCalledWith("token-2", { id: "user-2" }, false);
    expect(client.authStore.clear).toHaveBeenCalled();
    expect(authService.onChange(vi.fn(), true)).toBe(unsubscribe);
  });
  it("saves a session only after the server completes password authentication", async () => {
    const response = { token: "session", record: { id: "user-1" } };
    vi.mocked(api.post).mockResolvedValue(response);
    await expect(authService.loginWithPassword("mail@example.com", "password")).resolves.toEqual(
      response,
    );
    expect(api.post).toHaveBeenCalledWith("/api/auth/login", {
      identity: "mail@example.com",
      password: "password",
      remember: false,
    });
    expect(client.authStore.save).toHaveBeenCalledWith("session", response.record, false);
  });
  it("does not save a full session when a second factor is required", async () => {
    vi.mocked(api.post).mockResolvedValue({
      challenge: "challenge",
      expires_at: "2099-01-01",
      user_id: "user-1",
    });
    await expect(
      authService.loginWithPassword("mail@example.com", "password"),
    ).rejects.toMatchObject({
      name: "TotpRequiredError",
      challenge: { challenge: "challenge", expiresAt: "2099-01-01", userId: "user-1" },
    });
    expect(client.authStore.save).not.toHaveBeenCalled();
  });
  it("sends the trusted-device choice to the server", async () => {
    vi.mocked(api.post).mockResolvedValue({ token: "session", record: { id: "user-1" } });
    await authService.completeTotpLoginChallenge("challenge", "123456", true);
    expect(api.post).toHaveBeenCalledWith("/api/auth/totp/login-verify", {
      challenge: "challenge",
      code: "123456",
      remember: true,
    });
  });
  it("refreshes through the Monline auth endpoint", async () => {
    const response = { token: "refreshed", record: { id: "user-1" } };
    vi.mocked(api.post).mockResolvedValue(response);
    const signal = new AbortController().signal;
    await authService.refresh(signal);
    expect(api.post).toHaveBeenCalledWith("/api/auth/refresh", undefined, { signal });
    expect(client.authStore.save).toHaveBeenCalledWith("refreshed", response.record, false);
  });
  it("preserves the server's remembered session policy on login and refresh", async () => {
    const response = { token: "remembered", record: { id: "user-1" }, remember: true };
    vi.mocked(api.post).mockResolvedValue(response);
    await authService.loginWithPassword("mail@example.com", "password", true);
    expect(api.post).toHaveBeenCalledWith("/api/auth/login", {
      identity: "mail@example.com",
      password: "password",
      remember: true,
    });
    expect(client.authStore.save).toHaveBeenLastCalledWith(response.token, response.record, true);
    await authService.refresh();
    expect(client.authStore.save).toHaveBeenLastCalledWith(response.token, response.record, true);
  });

  it("requests password reset without exposing account data", async () => {
    vi.mocked(api.post).mockResolvedValue(undefined);
    await authService.requestPasswordReset("mail@example.com");
    expect(api.post).toHaveBeenCalledWith("/api/auth/password-reset", {
      email: "mail@example.com",
    });
  });
  it("identifies second-factor errors", () => {
    const error = new TotpRequiredError({ challenge: "c", expiresAt: "2099-01-01", userId: "u" });
    expect(isTotpRequiredError(error)).toBe(true);
    expect(isTotpRequiredError(new Error("other"))).toBe(false);
  });
});
