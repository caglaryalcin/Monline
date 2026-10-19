import { z } from "zod";

export interface PasswordFormValues {
  oldPwd: string;
  newPwd: string;
  confPwd: string;
}

export function buildPasswordSchema(t: (key: string, options?: Record<string, unknown>) => string) {
  return z
    .object({
      oldPwd: z.string().min(1, t("required")),
      newPwd: z.string().min(8, t("validation_min_chars", { count: 8 })),
      confPwd: z.string().min(1, t("required")),
    })
    .refine((data) => data.newPwd === data.confPwd, {
      message: t("passwords_no_match"),
      path: ["confPwd"],
    });
}
