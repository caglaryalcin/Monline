import { beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "@/lib/api";

import { setupService } from "./setup";

vi.mock("@/lib/api", () => ({ api: { post: vi.fn() } }));

describe("setup SMTP test", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sends only the administrator email and temporary SMTP configuration", async () => {
    const configuration = {
      email: "admin@example.test",
      language: "tr",
      smtp: {
        enabled: true,
        host: "smtp.example.test",
        port: 587,
        username: "admin",
        password: "test-password",
        senderAddress: "monline@example.test",
        senderName: "Monline",
        tls: true,
      },
    };
    vi.mocked(api.post).mockResolvedValue({ message: "setup_smtp_test_success" });
    await setupService.testSmtp(configuration);
    expect(api.post).toHaveBeenCalledWith("/api/auth/setup/smtp-test", configuration, {
      timeoutMs: 60_000,
    });
  });

  it("propagates safe server error keys for the setup screen", async () => {
    vi.mocked(api.post).mockRejectedValue(new Error("setup_smtp_test_auth_failed"));
    await expect(
      setupService.testSmtp({ email: "admin@example.test", language: "tr", smtp: {} as never }),
    ).rejects.toThrow("setup_smtp_test_auth_failed");
  });
});
