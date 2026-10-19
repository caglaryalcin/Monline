import { useQuery } from "@tanstack/react-query";
import { Mail } from "lucide-react";
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";

import { SettingsDisclosureButton } from "@/components/settings/shared/SettingsDisclosureButton";
import type { SMTPFormValues } from "@/components/settings/smtp/smtp.types";
import { SMTPAuthSection } from "@/components/settings/smtp/SMTPAuthSection";
import { SMTPSenderSection } from "@/components/settings/smtp/SMTPSenderSection";
import { SMTPServerSection } from "@/components/settings/smtp/SMTPServerSection";
import { SMTPStatusCard } from "@/components/settings/smtp/SMTPStatusCard";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { queryKeys } from "@/lib/queryKeys";
import { toast } from "@/lib/toast";
import { serverSettingsService } from "@/services/serverSettings";

export function SMTPTab({
  embedded = false,
  inline = false,
}: {
  embedded?: boolean;
  inline?: boolean;
}) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(true);
  const contentId = useId();
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [form, setForm] = useState<SMTPFormValues>({
    enabled: false,
    host: "",
    port: 587,
    username: "",
    password: "",
    tls: false,
    authMethod: "PLAIN",
    senderAddress: "",
    senderName: "",
  });
  const [hasExistingPassword, setHasExistingPassword] = useState(false);

  const smtpQuery = useQuery({
    queryKey: queryKeys.admin.smtp(),
    queryFn: async () => {
      const data = await serverSettingsService.getSmtp();
      setForm({
        enabled: !!data.enabled,
        host: (data.host as string) || "",
        port: (data.port as number) || 587,
        username: (data.username as string) || "",
        password: "",
        tls: !!data.tls,
        authMethod: (data.authMethod as string) || "PLAIN",
        senderAddress: (data.senderAddress as string) || "",
        senderName: (data.senderName as string) || "",
      });
      setHasExistingPassword(!!(data as Record<string, unknown>).hasPassword);
      return data;
    },
  });

  const set = <K extends keyof SMTPFormValues>(field: K, value: SMTPFormValues[K]) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const toggleEnabled = async (enabled: boolean) => {
    if (enabled) setExpanded(true);
    const previous = form.enabled;
    set("enabled", enabled);
    if (!embedded && !inline) return;
    setSaving(true);
    try {
      await serverSettingsService.updateSmtp({ enabled });
      toast.success(t("saved"));
    } catch (error) {
      set("enabled", previous);
      toast.error(error instanceof Error ? error.message : t("error"));
    } finally {
      setSaving(false);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      const body: Record<string, unknown> = { ...form };
      if (!form.password) delete body.password;
      await serverSettingsService.updateSmtp(body);
      toast.success(t("saved"));
      if (form.password) setHasExistingPassword(true);
      setForm((prev) => ({ ...prev, password: "" }));
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t("error"));
    } finally {
      setSaving(false);
    }
  };

  const testEmail = async () => {
    setTesting(true);
    try {
      await serverSettingsService.testSmtp();
      toast.success(t("test_sent"));
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t("error"));
    } finally {
      setTesting(false);
    }
  };

  return (
    <div
      className={
        inline
          ? "space-y-6"
          : embedded
            ? `overflow-hidden rounded-2xl border transition-colors ${form.enabled ? `${expanded ? "md:col-span-2" : ""} border-primary/30 bg-card` : "border-border/50 bg-muted/20"}`
            : "space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500"
      }
    >
      {embedded && (
        <div className="flex items-center gap-3 px-4 py-3">
          <div
            className={`shrink-0 rounded-xl p-2 ${form.enabled ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}
          >
            <Mail className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p
              id="notifications-smtp-label"
              className={`text-sm font-medium leading-none ${form.enabled ? "" : "text-muted-foreground"}`}
            >
              SMTP
            </p>
            <p id="notifications-smtp-description" className="mt-0.5 text-xs text-muted-foreground">
              {t("smtp_enable_description")}
            </p>
          </div>
          <Switch
            aria-labelledby="notifications-smtp-label"
            aria-describedby="notifications-smtp-description"
            checked={form.enabled}
            onCheckedChange={(enabled) => {
              void toggleEnabled(enabled);
            }}
            disabled={smtpQuery.isPending || smtpQuery.isError || saving || testing}
          />
          <SettingsDisclosureButton
            name="SMTP"
            expanded={form.enabled && expanded}
            controls={contentId}
            disabled={!form.enabled}
            onToggle={() => setExpanded((current) => !current)}
          />
        </div>
      )}
      <div
        id={contentId}
        hidden={embedded && !expanded}
        className={
          embedded ? (form.enabled ? "space-y-6 border-t border-inherit p-4" : "") : "space-y-8"
        }
      >
        {!embedded && (
          <SMTPStatusCard
            enabled={form.enabled}
            onEnabledChange={(value) => {
              if (inline) void toggleEnabled(value);
              else set("enabled", value);
            }}
            disabled={smtpQuery.isPending || smtpQuery.isError || saving || testing}
          />
        )}

        {form.enabled && (
          <fieldset disabled={saving || testing} className="space-y-8">
            <SMTPServerSection form={form} setField={set} />

            <Separator />

            <SMTPAuthSection form={form} hasExistingPassword={hasExistingPassword} setField={set} />

            <Separator />

            <SMTPSenderSection form={form} setField={set} />
          </fieldset>
        )}

        {(!embedded || form.enabled) && (
          <div className="flex items-center gap-3 flex-wrap pt-2">
            <Button
              onClick={save}
              disabled={saving || testing || smtpQuery.isPending || smtpQuery.isError}
              className="rounded-xl"
            >
              {inline && "SMTP · "}
              {saving ? t("saving") : t("save")}
            </Button>
            {form.enabled && !inline && (
              <Button
                variant="outline"
                onClick={testEmail}
                disabled={testing || saving}
                className="rounded-xl"
              >
                <Mail className="mr-2 h-4 w-4" />
                {testing ? t("sending") : t("send_test_email")}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
