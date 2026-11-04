import { z } from "zod";

import { supportedNumberLocale } from "@/lib/numberFormat";

export interface ProfileFormValues {
  username: string;
  email: string;
  oldPwd: string;
  language: string;
  number_locale?: string;
  country?: string;
  region?: string;
}

export function buildProfileSchema(t: (key: string, options?: Record<string, unknown>) => string) {
  return z.object({
    username: z.string().min(1, t("required")),
    email: z.string().min(1, t("required")).email(t("validation_invalid_email")),
    oldPwd: z.string(),
    language: z.string().min(1, t("required")),
    country: z.string().max(2).optional(),
    region: z.string().max(80).optional(),
    number_locale: z
      .string()
      .refine((value) => !value || !!supportedNumberLocale(value), t("number_format_invalid"))
      .optional(),
  });
}
