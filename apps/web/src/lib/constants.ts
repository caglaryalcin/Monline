/**
 * Centralized constants — single source of truth for magic strings.
 * Import from here instead of hardcoding values across the codebase.
 */

/** localStorage keys used across the application. */
export const LS_KEYS = {
  FINANCE_DECIMALS: "monline_finance_decimals",
  financeYear: (userId: string) => `monline_finance_year_${userId}`,
  LANGUAGE: "monline_language",
  COLOR_THEME: "monline_color_theme",
  SIDEBAR_WIDTH: "monline_sidebar_width",
  notificationDisclosure: (userId: string, providerId: string) =>
    `monline_notification_disclosure_${userId}_${providerId}`,
  /** Returns the trusted-device key for a given user (TOTP remember-device). */
  totpTrusted: (userId: string) => `totp_trusted_${userId}`,
} as const;

/** sessionStorage keys used across the application. */
export const SS_KEYS = {
  TOTP_LOGIN_CHALLENGE: "monline_totp_login_challenge",
  /** State issued before redirecting to the OIDC provider (CSRF protection). */
  OIDC_LOGIN_STATE: "monline_oidc_login_state",
} as const;
