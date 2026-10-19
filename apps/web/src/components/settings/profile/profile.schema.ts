import { z } from "zod";

export interface ProfileFormValues {
  username: string;
  email: string;
  oldPwd: string;
  language: string;
}

export function buildProfileSchema(t: (key: string, options?: Record<string, unknown>) => string) {
  return z.object({
    username: z.string().min(1, t("required")),
    email: z.string().min(1, t("required")).email(t("validation_invalid_email")),
    oldPwd: z.string(),
    language: z.string().min(1, t("required")),
  });
}
