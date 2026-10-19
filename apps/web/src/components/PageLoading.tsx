import { LoaderCircle } from "lucide-react";
import { useTranslation } from "react-i18next";

/** A page can load without replacing the persistent navigation and header. */
export function PageLoading() {
  const { t } = useTranslation();
  return (
    <div
      role="status"
      className="flex min-h-[240px] items-center justify-center gap-3 text-sm text-muted-foreground"
    >
      <LoaderCircle
        className="h-5 w-5 animate-spin motion-reduce:animate-none"
        aria-hidden="true"
      />
      <span>{t("loading")}</span>
    </div>
  );
}
