import { Eye, GripVertical, RotateCcw } from "lucide-react";
import { type DragEvent, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SUPPORTED_LANGUAGES } from "@/lib/languages";
import { notificationTemplateInsertion } from "@/lib/notificationTemplateInsertion";
import { toast } from "@/lib/toast";
import { notificationsService } from "@/services/notifications";
import type { NotificationEvent, NotificationTemplate } from "@/types";

const variables = [
  "title",
  "message",
  "subscriptions",
  "user_name",
  "user_email",
  "payer",
  "days",
  "count",
  "event",
  "date",
  "url",
  "language",
  "date_iso",
  "open_app",
];
const variableDragType = "application/x-monline-template-variable";
type TemplateInput = HTMLInputElement | HTMLTextAreaElement;
type TemplateField = keyof NotificationTemplate;

export function NotificationTemplateEditor({
  providerId,
  language,
  event,
  onEventChange,
  templates,
  defaults,
  onChange,
  disabled,
}: {
  providerId: string;
  language: string;
  event: NotificationEvent;
  onEventChange: (event: NotificationEvent) => void;
  templates: Partial<Record<NotificationEvent, NotificationTemplate>>;
  defaults?: Record<NotificationEvent, NotificationTemplate>;
  onChange: (templates: Partial<Record<NotificationEvent, NotificationTemplate>>) => void;
  disabled: boolean;
}) {
  const { t } = useTranslation();
  const [preview, setPreview] = useState<{ title: string; message: string; html: string } | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const inputs = useRef<Partial<Record<TemplateField, TemplateInput | null>>>({});
  const activeField = useRef<TemplateField>("message");
  const [dropField, setDropField] = useState<TemplateField | null>(null);
  useEffect(() => {
    if (!dropField) return;
    const clear = () => setDropField(null);
    window.addEventListener("dragend", clear);
    window.addEventListener("drop", clear);
    return () => {
      window.removeEventListener("dragend", clear);
      window.removeEventListener("drop", clear);
    };
  }, [dropField]);
  const fields = templates[event] ?? {};
  const fallback = defaults?.[event] ?? { title: "{{title}}", message: "{{message}}", html: "" };
  const update = (field: keyof NotificationTemplate, value: string) => {
    setPreview(null);
    onChange({ ...templates, [event]: { ...fields, [field]: value } });
  };
  const insertVariable = (variable: string) => {
    const field = inputs.current[activeField.current] ? activeField.current : "message";
    const input = inputs.current[field];
    const insertion = notificationTemplateInsertion(input, variable, disabled || loading);
    if (!insertion) return;
    update(field, insertion.value);
    requestAnimationFrame(() => {
      insertion.input.focus();
      insertion.input.setSelectionRange(insertion.cursor, insertion.cursor);
    });
  };
  const dropProps = (field: TemplateField) => ({
    onFocus: () => {
      activeField.current = field;
    },
    onDragEnter: (event: DragEvent<TemplateInput>) => {
      if (!disabled && !loading && event.dataTransfer.types.includes(variableDragType))
        setDropField(field);
    },
    onDragOver: (event: DragEvent<TemplateInput>) => {
      if (!disabled && !loading && event.dataTransfer.types.includes(variableDragType)) {
        // Native text dropping places the variable at the pointer's caret position.
        event.dataTransfer.dropEffect = "copy";
      }
    },
    onDragLeave: () => setDropField((current) => (current === field ? null : current)),
    onDrop: () => setDropField(null),
  });
  const dropClass = (field: TemplateField) =>
    dropField === field ? "border-primary ring-2 ring-primary/30" : "";
  const showPreview = async () => {
    setLoading(true);
    try {
      setPreview(
        await notificationsService.previewTemplate(
          providerId,
          event,
          { [providerId]: templates },
          language,
        ),
      );
    } catch (error) {
      toast.error(
        t(error instanceof Error ? error.message : "error", { defaultValue: t("error") }),
      );
    } finally {
      setLoading(false);
    }
  };
  const prefix = `notification-template-${providerId}-${event}`;
  return (
    <fieldset disabled={disabled || loading} className="min-w-0 space-y-3">
      <legend className="mb-2 text-sm font-medium">{t("notification_template")}</legend>
      <p className="text-xs leading-relaxed text-muted-foreground">
        {t("notification_template_language_hint", {
          language: SUPPORTED_LANGUAGES.find((item) => item.code === language)?.name || language,
        })}
      </p>
      <div
        className="flex flex-wrap gap-2"
        role="group"
        aria-label={t("notification_template_event")}
      >
        {(["payment", "cancellation"] as const).map((value) => (
          <Button
            key={value}
            type="button"
            size="sm"
            variant={value === event ? "default" : "outline"}
            aria-pressed={value === event}
            className="h-8 rounded-lg text-xs"
            onClick={() => {
              setPreview(null);
              onEventChange(value);
            }}
          >
            {t(`notification_template_${value}`)}
          </Button>
        ))}
      </div>
      {!["telegram", "mattermost"].includes(providerId) && (
        <div className="space-y-1.5">
          <Label htmlFor={`${prefix}-title`} className="text-xs">
            {t(
              providerId === "email"
                ? "notification_template_subject"
                : "notification_template_title",
            )}
          </Label>
          <Input
            ref={(input) => {
              inputs.current.title = input;
            }}
            id={`${prefix}-title`}
            maxLength={300}
            value={fields.title ?? fallback.title ?? ""}
            onChange={(event) => update("title", event.target.value)}
            {...dropProps("title")}
            className={`h-9 rounded-xl bg-background text-sm ${dropClass("title")}`}
          />
        </div>
      )}
      <div className="space-y-1.5">
        <Label htmlFor={`${prefix}-message`} className="text-xs">
          {t(
            providerId === "email"
              ? "notification_template_plain_text"
              : "notification_template_message",
          )}
        </Label>
        <Textarea
          ref={(input) => {
            inputs.current.message = input;
          }}
          id={`${prefix}-message`}
          rows={3}
          maxLength={8192}
          value={fields.message ?? fallback.message ?? ""}
          onChange={(event) => update("message", event.target.value)}
          {...dropProps("message")}
          className={`resize-y rounded-xl bg-background text-sm ${dropClass("message")}`}
        />
      </div>
      {providerId === "email" && (
        <div className="space-y-1.5">
          <Label htmlFor={`${prefix}-html`} className="text-xs">
            {t("notification_template_html")}
          </Label>
          <Textarea
            ref={(input) => {
              inputs.current.html = input;
            }}
            id={`${prefix}-html`}
            rows={10}
            maxLength={131072}
            spellCheck={false}
            value={fields.html ?? fallback.html ?? ""}
            onChange={(event) => update("html", event.target.value)}
            {...dropProps("html")}
            className={`min-h-48 resize-y rounded-xl bg-background font-mono text-xs ${dropClass("html")}`}
          />
          <p className="text-xs leading-relaxed text-muted-foreground">
            {t("notification_template_html_hint")}
          </p>
        </div>
      )}
      <details className="rounded-lg border bg-muted/20 px-3 py-2 text-xs">
        <summary className="cursor-pointer font-medium">
          {t("notification_template_variables")}
        </summary>
        <p className="my-2 leading-relaxed text-muted-foreground">
          {t("notification_template_variables_hint")}
        </p>
        <p className="mb-2 leading-relaxed text-muted-foreground">
          {t("notification_template_drag_hint")}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {variables.map((variable) => (
            <button
              key={variable}
              type="button"
              draggable={!disabled && !loading}
              disabled={disabled || loading}
              onDragStart={(event) => {
                event.dataTransfer.effectAllowed = "copy";
                event.dataTransfer.setData(variableDragType, variable);
                event.dataTransfer.setData("text/plain", `{{${variable}}}`);
              }}
              onDragEnd={() => setDropField(null)}
              onClick={() => insertVariable(variable)}
              aria-label={t("notification_template_insert_variable", {
                variable: `{{${variable}}}`,
              })}
              className="inline-flex cursor-grab select-none items-center gap-1 rounded-lg border bg-background px-2 py-1.5 font-mono text-xs transition-colors hover:border-primary hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-50"
            >
              <GripVertical className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
              {`{{${variable}}}`}
            </button>
          ))}
        </div>
      </details>
      <div
        className={
          providerId === "email" ? "flex flex-col gap-2" : "flex flex-wrap justify-end gap-2"
        }
      >
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={`h-8 gap-1.5 rounded-lg text-xs ${providerId === "email" ? "self-end" : ""}`}
          onClick={() => {
            setPreview(null);
            onChange({ ...templates, [event]: {} });
          }}
        >
          <RotateCcw className="h-3.5 w-3.5" />
          {t("notification_template_reset")}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={
            providerId === "email"
              ? "h-11 w-full gap-2 rounded-xl text-sm"
              : "h-8 gap-1.5 rounded-lg text-xs"
          }
          onClick={showPreview}
        >
          <Eye className="h-3.5 w-3.5" />
          {t(loading ? "loading" : "notification_template_preview")}
        </Button>
      </div>
      {preview && (
        <div className="space-y-2 rounded-xl border bg-background p-3">
          <p className="text-xs text-muted-foreground">{t("notification_template_preview_hint")}</p>
          <p className="break-words text-sm font-medium">{preview.title}</p>
          {providerId === "email" ? (
            <iframe
              title={t("notification_template_preview")}
              sandbox=""
              referrerPolicy="no-referrer"
              srcDoc={preview.html}
              className="h-[320px] w-full rounded-lg border bg-white"
            />
          ) : (
            <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words text-xs">
              {preview.message}
            </pre>
          )}
        </div>
      )}
    </fieldset>
  );
}
