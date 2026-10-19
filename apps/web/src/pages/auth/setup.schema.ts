import type { TFunction } from "i18next";
import { z } from "zod";

import { SUPPORTED_LANGUAGES } from "@/lib/languages";

export const SETUP_CURRENCIES = [
  "TRY",
  "USD",
  "EUR",
  "GBP",
  "BRL",
  "JPY",
  "CAD",
  "AUD",
  "CHF",
] as const;

export function setupSchema(t: TFunction) {
  return z
    .object({
      username: z
        .string()
        .trim()
        .min(3, t("validation_min_chars", { count: 3 }))
        .max(50),
      email: z.string().trim().email(t("validation_invalid_email")).max(254),
      password: z
        .string()
        .min(8, t("validation_min_chars", { count: 8 }))
        .refine((value) => new TextEncoder().encode(value).length <= 72, t("setup_password_max")),
      passwordConfirm: z.string().min(1, t("required")),
      language: z
        .string()
        .refine((value) => SUPPORTED_LANGUAGES.some((language) => language.code === value)),
      currency: z.enum(SETUP_CURRENCIES),
      budget: z
        .string()
        .refine(
          (value) =>
            value.trim() !== "" &&
            Number.isFinite(Number(value)) &&
            Number(value) >= 0 &&
            Number(value) <= 1e12,
          t("setup_budget_invalid"),
        ),
      darkThemeMode: z.enum(["0", "1", "2"]),
      openRegistrations: z.boolean(),
      serverUrl: z.string().refine((value) => {
        try {
          const url = new URL(value);
          return (
            ["http:", "https:"].includes(url.protocol) &&
            !url.username &&
            !url.password &&
            !url.search &&
            !url.hash &&
            url.pathname === "/"
          );
        } catch {
          return false;
        }
      }, t("setup_url_invalid")),
      smtpEnabled: z.boolean(),
      smtpHost: z.string(),
      smtpPort: z.string(),
      smtpUsername: z.string(),
      smtpPassword: z.string(),
      smtpSenderName: z.string(),
      smtpSenderAddress: z.string(),
      smtpTls: z.boolean(),
    })
    .superRefine((data, context) => {
      if (data.password !== data.passwordConfirm)
        context.addIssue({
          code: "custom",
          path: ["passwordConfirm"],
          message: t("passwords_no_match"),
        });
      if (data.smtpEnabled) {
        const invalid = (field: string, message = t("required")) =>
          context.addIssue({ code: "custom", path: [field], message });
        if (
          !data.smtpHost.trim() ||
          data.smtpHost.length > 253 ||
          // eslint-disable-next-line no-control-regex -- SMTP hosts must reject all ASCII control characters.
          /[\s/\\\x00-\x1f]/.test(data.smtpHost)
        )
          invalid("smtpHost");
        if (
          !data.smtpPort.trim() ||
          !Number.isInteger(Number(data.smtpPort)) ||
          Number(data.smtpPort) < 1 ||
          Number(data.smtpPort) > 65535
        )
          invalid("smtpPort");
        if (!z.string().email().safeParse(data.smtpSenderAddress.trim()).success)
          invalid("smtpSenderAddress", t("validation_invalid_email"));
        for (const key of [
          "smtpUsername",
          "smtpPassword",
          "smtpSenderName",
          "smtpSenderAddress",
        ] as const)
          // eslint-disable-next-line no-control-regex -- SMTP headers and credentials must reject NUL and line breaks.
          if (data[key].length > 1024 || /[\x00\r\n]/.test(data[key])) invalid(key);
      }
    });
}

export type SetupForm = z.infer<ReturnType<typeof setupSchema>>;
export const SETUP_FIELDS: (keyof SetupForm)[][] = [
  ["username", "email", "password", "passwordConfirm"],
  ["language", "currency", "budget", "darkThemeMode", "openRegistrations", "serverUrl"],
  [
    "smtpEnabled",
    "smtpHost",
    "smtpPort",
    "smtpUsername",
    "smtpPassword",
    "smtpSenderName",
    "smtpSenderAddress",
    "smtpTls",
  ],
];
