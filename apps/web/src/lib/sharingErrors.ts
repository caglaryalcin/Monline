import type { TFunction } from "i18next";

export function sharingErrorMessage(t: TFunction, error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  if (["sharing_", "people_", "household_"].some((prefix) => message.startsWith(prefix)))
    return t(message, { defaultValue: t("sharing_request_failed") });

  const status = error && typeof error === "object" && "status" in error ? error.status : 0;
  if (status === 401 || status === 403) return t("sharing_sign_in_again");
  if (status === 404) return t("sharing_api_unavailable");
  if (typeof status === "number" && status >= 500) return t("sharing_server_error");
  if (!status) return t("sharing_connection_failed");
  return t("sharing_request_failed");
}
