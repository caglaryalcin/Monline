import { Inbox, Mail } from "lucide-react";
import { useTranslation } from "react-i18next";

export function NotificationEmailPreview({
  title,
  html,
  loading,
}: {
  title: string;
  html: string;
  loading: boolean;
}) {
  const { t } = useTranslation();
  return (
    <section
      aria-label={t("notification_email_preview")}
      aria-busy={loading}
      className="min-w-0 overflow-hidden rounded-xl border bg-background"
    >
      <div className="flex items-center gap-2 border-b bg-muted/40 px-4 py-2.5 text-xs">
        <Inbox className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        <span className="font-medium">{t("notification_email_preview_inbox")}</span>
        <span className="ml-auto rounded-md border bg-background px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
          SMTP
        </span>
      </div>
      <div className="flex items-start gap-3 px-4 py-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Mail className="h-4 w-4" aria-hidden="true" />
        </div>
        <div className="min-w-0 space-y-1">
          <p className="text-xs font-medium text-muted-foreground">
            {t("notification_template_subject")}
          </p>
          <h3 className="break-words text-base font-semibold leading-snug">{title}</h3>
        </div>
      </div>
      <div className="border-t">
        <p className="border-b bg-muted/20 px-4 py-2 text-xs font-medium text-muted-foreground">
          {t("notification_email_preview_body")}
        </p>
        <iframe
          title={t("notification_email_preview_body")}
          sandbox=""
          referrerPolicy="no-referrer"
          srcDoc={html}
          className="block h-[320px] w-full bg-white"
        />
      </div>
    </section>
  );
}
