import { Save, SendHorizontal } from "lucide-react";
import { type ReactNode, useId, useState } from "react";
import { useTranslation } from "react-i18next";

import type { ProviderConfig } from "@/components/settings/notifications/config";
import { SettingsDisclosureButton } from "@/components/settings/shared/SettingsDisclosureButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { NotificationsConfig } from "@/types";

interface ProviderCardProps {
  provider: ProviderConfig;
  formData: Partial<NotificationsConfig>;
  onChange: (key: keyof NotificationsConfig, value: unknown) => void;
  onTest: () => void;
  onSave?: () => void;
  isSaving?: boolean;
  saveDisabled?: boolean;
  isTesting: boolean;
  children?: ReactNode;
  toggleDisabled?: boolean;
  disclosureStorageKey?: string;
}

export function ProviderCard({
  provider,
  formData,
  onChange,
  onTest,
  onSave,
  isSaving = false,
  saveDisabled = false,
  isTesting,
  children,
  toggleDisabled = false,
  disclosureStorageKey,
}: ProviderCardProps) {
  const { t } = useTranslation();
  const [expansionChoice, setExpansionChoice] = useState<boolean | null>(() => {
    if (disclosureStorageKey) {
      try {
        const stored = localStorage.getItem(disclosureStorageKey);
        if (stored === "true" || stored === "false") return stored === "true";
      } catch {
        // Keep the disclosure usable when browser storage is unavailable.
      }
    }
    return null;
  });
  const changeExpansion = (next: boolean) => {
    setExpansionChoice(next);
    if (disclosureStorageKey) {
      try {
        localStorage.setItem(disclosureStorageKey, String(next));
      } catch {
        // The current page still remembers the choice without persistence.
      }
    }
  };
  const contentId = useId();
  const isEnabled = !!formData[provider.enabledKey];
  const expanded = expansionChoice ?? isEnabled;
  const Icon = provider.icon;

  return (
    <section
      aria-label={provider.label}
      className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
        isEnabled
          ? `bg-card ${expanded ? "md:col-span-2" : ""} ${provider.borderClass}`
          : `${expanded ? "md:col-span-2" : ""} bg-muted/20 border-border/50`
      }`}
    >
      <div className="relative">
        <button
          type="button"
          aria-label={provider.label}
          aria-expanded={expanded}
          aria-controls={contentId}
          onClick={() => changeExpansion(!expanded)}
          className="flex w-full min-w-0 items-center gap-3 px-4 py-3 pr-28 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary disabled:cursor-default"
        >
          <div
            className={`p-2 rounded-xl shrink-0 transition-colors ${
              isEnabled
                ? `${provider.bgClass} ${provider.colorClass}`
                : "bg-muted text-muted-foreground"
            }`}
          >
            <Icon className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p
              className={`font-medium text-sm leading-none ${
                isEnabled ? "" : "text-muted-foreground"
              }`}
            >
              {provider.label}
            </p>
            {isEnabled && (
              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                {t(provider.descriptionKey, provider.label)}
              </p>
            )}
          </div>
        </button>
        <div className="pointer-events-none absolute inset-y-0 right-4 flex items-center gap-3 [&>button]:pointer-events-auto">
          <Switch
            aria-label={provider.label}
            checked={isEnabled}
            disabled={toggleDisabled}
            onCheckedChange={(checked) => {
              changeExpansion(true);
              onChange(provider.enabledKey, checked);
            }}
          />
          <SettingsDisclosureButton
            name={provider.label}
            expanded={expanded}
            controls={contentId}
            onToggle={() => changeExpansion(!expanded)}
          />
        </div>
      </div>

      <div id={contentId} hidden={!expanded}>
        <div className="px-4 pb-4 space-y-3 border-t border-inherit pt-3">
          <div
            className={`grid gap-3 ${
              provider.fields.length > 1 ? "sm:grid-cols-2" : "grid-cols-1"
            }`}
          >
            {provider.fields.map((field) => (
              <div key={field.key} className="space-y-1.5">
                <Label htmlFor={`${contentId}-${field.key}`} className="text-xs">
                  {t(field.labelKey, field.labelKey)}
                </Label>
                <Input
                  id={`${contentId}-${field.key}`}
                  type={field.type}
                  disabled={!isEnabled}
                  value={(formData[field.key] as string) || ""}
                  onChange={(e) => onChange(field.key, e.target.value)}
                  placeholder={field.placeholder}
                  className="bg-background h-9 rounded-xl text-sm"
                />
              </div>
            ))}
          </div>

          {provider.hintKey && (
            <p className="text-xs text-muted-foreground">{t(provider.hintKey)}</p>
          )}

          {children && <div className="border-t border-inherit pt-4">{children}</div>}
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onTest}
              disabled={isTesting || !isEnabled || isSaving || saveDisabled}
              className="h-8 rounded-xl gap-1.5 text-xs"
            >
              <SendHorizontal className="w-4 h-4" />
              {isTesting ? t("sending", "Sending…") : t("test_notification", "Test")}
            </Button>
            {onSave && (
              <Button
                size="sm"
                onClick={onSave}
                disabled={isSaving || isTesting || saveDisabled}
                className="h-8 rounded-xl gap-1.5 text-xs"
              >
                <Save className="w-4 h-4" />
                {isSaving ? t("saving", "Saving…") : t("save", "Save")}
              </Button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
