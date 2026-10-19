import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { useUserSettingsMutation } from "@/components/settings/shared/useUserSettingsMutation";
import { setDocumentTheme } from "@/lib/documentTheme";
import { toast } from "@/lib/toast";

export function ThemeToggle() {
  const { t } = useTranslation();
  const mutation = useUserSettingsMutation();
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));
  useEffect(() => {
    const root = document.documentElement;
    const observer = new MutationObserver(() => setDark(root.classList.contains("dark")));
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);
  const label = t(dark ? "switch_to_light" : "switch_to_dark");
  return (
    <button
      type="button"
      className="header-theme-toggle"
      aria-label={label}
      title={label}
      disabled={mutation.isPending}
      onClick={() => {
        const root = document.documentElement;
        const previous = root.classList.contains("dark");
        setDocumentTheme(!previous);
        setDark(!previous);
        mutation.mutate(
          { dark_theme_mode: previous ? 0 : 1 },
          {
            onError: () => {
              setDocumentTheme(previous);
              setDark(previous);
              toast.error(t("theme_save_error"));
            },
          },
        );
      }}
    >
      <img
        src={dark ? "/assets/theme-sun.png" : "/assets/theme-moon.png"}
        alt=""
        aria-hidden="true"
        className="header-theme-toggle-icon"
        width={24}
        height={24}
      />
    </button>
  );
}
