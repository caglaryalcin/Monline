import { Check, X } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface HouseholdMemberFormRowProps {
  accountEmail?: string;
  onAccountEmailChange?: (value: string) => void;
  pending?: boolean;
  error?: string;
  name: string;
  onCancel: () => void;
  onNameChange: (value: string) => void;
  onSubmit: () => void;
}

export function HouseholdMemberFormRow({
  accountEmail = "",
  onAccountEmailChange,
  pending = false,
  error,
  name,
  onCancel,
  onNameChange,
  onSubmit,
}: HouseholdMemberFormRowProps) {
  const { t } = useTranslation();

  return (
    <form
      className="flex flex-wrap items-start gap-3 p-4 rounded-2xl border border-border bg-card"
      onSubmit={(event) => {
        event.preventDefault();
        if (!pending) onSubmit();
      }}
    >
      <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-2">
        <Label className="space-y-2">
          <span className="text-xs text-muted-foreground">{t("household_display_name")}</span>
          <Input
            autoFocus
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder={t("member_name_placeholder")}
            aria-label={t("household_display_name")}
            required={!onAccountEmailChange}
            disabled={pending}
            className="min-w-0 flex-1 rounded-xl border-input bg-background text-sm focus-visible:ring-ring"
          />
        </Label>
        {onAccountEmailChange && (
          <Label className="space-y-2">
            <span className="text-xs text-muted-foreground">{t("household_account_email")}</span>
            <Input
              type="email"
              required
              value={accountEmail}
              onChange={(event) => onAccountEmailChange(event.target.value)}
              placeholder={t("sharing_email_placeholder")}
              aria-label={t("household_account_email")}
              disabled={pending}
              className="min-w-0 rounded-xl bg-background text-sm"
            />
          </Label>
        )}
      </div>
      <Button
        type="submit"
        size="icon"
        variant="ghost"
        disabled={pending || (onAccountEmailChange ? !accountEmail.trim() : !name.trim())}
        aria-label={t("save")}
        className="mt-6 shrink-0 text-primary"
      >
        <Check className="w-5 h-5" />
      </Button>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="mt-6 shrink-0 text-muted-foreground"
        onClick={onCancel}
        disabled={pending}
        aria-label={t("cancel")}
      >
        <X className="w-5 h-5" />
      </Button>
      {onAccountEmailChange && (
        <p className="w-full text-xs leading-relaxed text-muted-foreground">
          {t("household_account_link_hint")}
        </p>
      )}
      {error && (
        <p role="alert" className="w-full text-sm text-destructive">
          {error}
        </p>
      )}
    </form>
  );
}
