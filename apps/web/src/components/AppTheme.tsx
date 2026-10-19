import i18n from "i18next";
import { useEffect } from "react";

import { useAuth } from "@/contexts/AuthContext";
import { buildColorCSS, getPreset, saveColorToStorage } from "@/lib/color-presets";
import { setDocumentTheme } from "@/lib/documentTheme";

/** Applies user preferences: dark mode, color theme, custom CSS. Renders nothing. */
export function AppTheme() {
  const { user } = useAuth();

  useEffect(() => {
    if (user?.language && i18n.hasResourceBundle(user.language, "translation")) {
      void i18n.changeLanguage(user.language);
    }
  }, [user?.language]);

  useEffect(() => {
    const darkTheme = user?.dark_theme_mode;

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const followSystem = (event: MediaQueryListEvent) => {
      if (darkTheme !== 0 && darkTheme !== 1) setDocumentTheme(event.matches);
    };
    media.addEventListener?.("change", followSystem);
    if (darkTheme === 1) {
      setDocumentTheme(true);
    } else if (darkTheme === 0) {
      setDocumentTheme(false);
    } else {
      const prefersDark = media.matches;
      setDocumentTheme(prefersDark);
    }

    // Color theme
    if (user?.color_theme) {
      saveColorToStorage(user.color_theme);
      const preset = getPreset(user.color_theme);
      let colorEl = document.getElementById("color-theme") as HTMLStyleElement | null;
      if (!colorEl) {
        colorEl = document.createElement("style");
        colorEl.id = "color-theme";
        document.head.appendChild(colorEl);
      }
      colorEl.textContent = buildColorCSS(preset);
    }

    // Custom CSS
    let styleEl = document.getElementById("custom-css") as HTMLStyleElement | null;
    if (user?.custom_css) {
      if (!styleEl) {
        styleEl = document.createElement("style");
        styleEl.id = "custom-css";
        document.head.appendChild(styleEl);
      }
      styleEl.textContent = user.custom_css;
    } else if (styleEl) {
      styleEl.textContent = "";
    }
    return () => media.removeEventListener?.("change", followSystem);
  }, [user?.dark_theme_mode, user?.color_theme, user?.custom_css]);

  return null;
}
