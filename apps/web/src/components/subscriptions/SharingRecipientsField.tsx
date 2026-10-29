import { BadgeCheck, Clock3, Eye, PencilLine, UserRound, X } from "lucide-react";
import { useTranslation } from "react-i18next";

import { cn } from "@/lib/utils";
import type { SharingPermission } from "@/services/sharing";
import { parseSharingEmails } from "@/services/sharing";

export function SharingRecipientsField({
  emails,
  draft,
  permissions,
  selectedEmail,
  pendingEmails = [],
  confirmedEmails = [],
  inputId = "sharing-emails",
  showPermissions = true,
  disabled,
  error,
  onDraftChange,
  onCommit,
  onSelect,
  onRemove,
}: {
  emails: string[];
  draft: string;
  permissions: Record<string, SharingPermission>;
  selectedEmail: string;
  pendingEmails?: string[];
  confirmedEmails?: string[];
  inputId?: string;
  showPermissions?: boolean;
  disabled: boolean;
  error: string | null;
  onDraftChange: (value: string) => void;
  onCommit: (value: string) => void;
  onSelect: (email: string) => void;
  onRemove: (email: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <div>
      <div
        data-invalid={!!error}
        className={cn(
          "sharing-recipients-field flex min-h-[84px] flex-wrap items-start gap-2 rounded-xl border bg-muted/20 p-3 transition-colors focus-within:border-primary focus-within:ring-1 focus-within:ring-primary",
          error ? "border-destructive" : "border-input",
          disabled && "opacity-60",
        )}
      >
        {emails.map((email) => {
          const permission = permissions[email] ?? "read";
          const Icon = permission === "edit" ? PencilLine : Eye;
          return (
            <span
              key={email}
              data-selected={selectedEmail === email}
              className={cn(
                "sharing-recipient-chip inline-flex max-w-full items-center rounded-lg border text-xs",
                selectedEmail === email ? "border-primary bg-primary/15" : "border-border bg-card",
              )}
            >
              <button
                type="button"
                disabled={disabled}
                aria-pressed={selectedEmail === email}
                onClick={() => onSelect(email)}
                onKeyDown={(event) => {
                  if (event.key === "Delete" || event.key === "Backspace") {
                    event.preventDefault();
                    onRemove(email);
                  }
                }}
                title={
                  showPermissions
                    ? `${email} · ${t(permission === "edit" ? "sharing_can_edit" : "sharing_read_only")}`
                    : email
                }
                className="flex min-w-0 items-center gap-1.5 rounded-l-lg px-2 py-1.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <UserRound
                  className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
                <span className="truncate">{email}</span>
                {showPermissions && (
                  <Icon className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden="true" />
                )}
                {confirmedEmails.includes(email) && (
                  <BadgeCheck
                    className="h-3.5 w-3.5 shrink-0"
                    aria-label={t("household_account_confirmed")}
                  />
                )}
                {pendingEmails.includes(email) && (
                  <span className="inline-flex shrink-0 items-center gap-1 text-[10px] text-muted-foreground">
                    <Clock3 className="h-3 w-3" aria-hidden="true" />
                    {t("people_invitation_pending")}
                  </span>
                )}
              </button>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onRemove(email)}
                aria-label={t("sharing_remove_recipient", { email })}
                className="mr-1 shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            </span>
          );
        })}
        <input
          id={inputId}
          type="text"
          inputMode="email"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={25600}
          value={draft}
          disabled={disabled}
          aria-invalid={!!error}
          aria-describedby={error ? `${inputId}-hint ${inputId}-error` : `${inputId}-hint`}
          placeholder={t("sharing_email_placeholder")}
          onChange={(event) => onDraftChange(event.target.value)}
          onBlur={() => {
            if (draft.trim()) onCommit(draft);
          }}
          onKeyDown={(event) => {
            if (event.nativeEvent.isComposing) return;
            if (["Enter", ",", ";"].includes(event.key)) {
              event.preventDefault();
              onCommit(draft);
            } else if (event.key === "Backspace" && !draft && emails.length) {
              onSelect(emails[emails.length - 1]);
            }
          }}
          onPaste={(event) => {
            const text = event.clipboardData.getData("text/plain");
            if (parseSharingEmails(text).length > 1) {
              event.preventDefault();
              onCommit(draft ? `${draft}\n${text}` : text);
            }
          }}
          className="h-8 min-w-0 flex-[1_1_180px] bg-transparent px-0.5 text-sm outline-none placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground disabled:cursor-not-allowed"
        />
      </div>
      {error && (
        <p id={`${inputId}-error`} role="alert" className="mt-2 text-xs text-destructive">
          {t(error)}
        </p>
      )}
    </div>
  );
}
