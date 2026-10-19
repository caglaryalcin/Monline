import { buildProfileSchema } from "@/components/settings/profile/profile.schema";
import { buildPasswordSchema } from "@/components/settings/security/security.schema";

function t(key: string, options?: Record<string, unknown>) {
  return options?.count ? `${key}:${String(options.count)}` : key;
}

describe("profile.schema", () => {
  it("accepts valid profile data", () => {
    const schema = buildProfileSchema(t);

    expect(
      schema.parse({
        username: "daniel",
        email: "daniel@example.com",
        oldPwd: "old-secret",
        newPwd: "new-secret",
        confPwd: "new-secret",
        language: "pt_br",
      }),
    ).toMatchObject({
      username: "daniel",
      email: "daniel@example.com",
    });
  });

  it("requires username, email, and language", () => {
    const schema = buildProfileSchema(t);
    const result = schema.safeParse({
      username: "",
      email: "",
      oldPwd: "",
      newPwd: "",
      confPwd: "",
      language: "",
    });

    expect(result.success).toBe(false);
    expect(result.error?.flatten().fieldErrors.username).toContain("required");
    expect(result.error?.flatten().fieldErrors.email).toContain("required");
    expect(result.error?.flatten().fieldErrors.language).toContain("required");
  });

  it("validates profile email format", () => {
    const result = buildProfileSchema(t).safeParse({
      username: "daniel",
      email: "invalid-email",
      oldPwd: "",
      language: "pt_br",
    });
    expect(result.success).toBe(false);
    expect(result.error?.flatten().fieldErrors.email).toContain("validation_invalid_email");
  });

  it("validates password length, confirmation and current password in security", () => {
    const schema = buildPasswordSchema(t);
    const result = schema.safeParse({
      username: "daniel",
      email: "invalid-email",
      oldPwd: "",
      newPwd: "short",
      confPwd: "different",
      language: "pt_br",
    });

    expect(result.success).toBe(false);
    expect(result.error?.flatten().fieldErrors.newPwd).toContain("validation_min_chars:8");
    expect(result.error?.flatten().fieldErrors.confPwd).toContain("passwords_no_match");
    expect(result.error?.flatten().fieldErrors.oldPwd).toContain("required");
  });
});
