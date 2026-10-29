import { BadgeCheck, Clock3, Edit2, Link2, Mail, Star, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import type { Household } from "@/types";

interface HouseholdMemberListItemProps {
  accountEmail?: string;
  accountConfirmed?: boolean;
  invitationStatus?: Household["invitation_status"];
  onResend?: () => void;
  resendPending?: boolean;
  memberName: string;
  onDelete?: () => void;
  onEdit: () => void;
  isMain?: boolean;
  onSetMain?: () => void;
  mainPending?: boolean;
}

export function HouseholdMemberListItem({
  accountEmail,
  accountConfirmed = false,
  invitationStatus,
  onResend,
  resendPending = false,
  memberName,
  onDelete,
  onEdit,
  isMain = false,
  onSetMain,
  mainPending = false,
}: HouseholdMemberListItemProps) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-between p-4 rounded-2xl border bg-card transition-colors group">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="break-words font-medium text-lg">{memberName}</span>
          {accountConfirmed && (
            <span className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-xs text-foreground">
              <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" />
              {t("household_account_confirmed")}
            </span>
          )}
          {!accountConfirmed && accountEmail && (
            <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 px-2 py-0.5 text-xs text-muted-foreground">
              <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
              {t(
                invitationStatus === "delivery_failed"
                  ? "people_invitation_delivery_failed"
                  : invitationStatus === "expired"
                    ? "people_invitation_expired"
                    : invitationStatus === "pending"
                      ? "people_invitation_pending"
                      : "people_invitation_not_requested",
              )}
            </span>
          )}
        </div>
        {accountEmail ? (
          <span className="mt-1 flex items-start gap-1.5 text-xs text-muted-foreground">
            <Link2 className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
            <span className="break-all">{accountEmail}</span>
          </span>
        ) : (
          <span className="mt-1 block text-xs text-muted-foreground">
            {t("household_unlinked_account")}
          </span>
        )}
      </div>
      <div className="flex opacity-100 transition-opacity">
        {onResend && !accountConfirmed && accountEmail && (
          <Button
            size="icon"
            variant="ghost"
            disabled={resendPending}
            onClick={onResend}
            aria-label={t("people_invitation_resend")}
            title={t("people_invitation_resend")}
          >
            <Mail className="h-4 w-4" />
          </Button>
        )}
        {onSetMain && (
          <Button
            size="icon"
            variant="ghost"
            className={isMain ? "text-primary" : "text-muted-foreground"}
            aria-label={t(isMain ? "main_household_member" : "set_as_main_household_member")}
            title={t(isMain ? "main_household_member" : "set_as_main_household_member")}
            aria-pressed={isMain}
            disabled={isMain || mainPending}
            onClick={onSetMain}
          >
            <Star className={`h-4 w-4 ${isMain ? "fill-current" : ""}`} />
          </Button>
        )}
        <Button
          size="icon"
          variant="ghost"
          className="text-muted-foreground "
          onClick={onEdit}
          aria-label={t("edit")}
        >
          <Edit2 className="w-4 h-4" />
        </Button>
        {onDelete && (
          <Button
            size="icon"
            variant="ghost"
            className="text-destructive/70 "
            onClick={onDelete}
            aria-label={t("delete")}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
