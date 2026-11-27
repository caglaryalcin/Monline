import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLocalToday } from "@/hooks/useLocalToday";
import { type BillingPause, planBillingPause, validateBillingPauses } from "@/lib/subscriptionPauses";
import { formatDate } from "@/lib/utils";
import type { Subscription } from "@/types";

export function SubscriptionPauseEditor({ subscription, cycleName, value, onChange }: {
  subscription: Subscription;
  cycleName: string;
  value: BillingPause[];
  onChange: (value: BillingPause[]) => void;
}) {
  const { t, i18n } = useTranslation();
  const today = useLocalToday();
  const language = i18n?.resolvedLanguage ?? i18n?.language ?? "en";
  const [after, setAfter] = useState("0");
  const [duration, setDuration] = useState("1");
  const preview = useMemo(() => {
    try {
      if (!after.trim() || !duration.trim()) throw Error("billing_pauses_invalid");
      const pause = planBillingPause(subscription, cycleName, Number(after), Number(duration), today);
      return { pause, pauses: validateBillingPauses([...value, pause]), error: "" };
    } catch (error) {
      return { error: error instanceof Error ? error.message : "billing_pauses_invalid" };
    }
  }, [subscription, cycleName, after, duration, today, value]);
  return <section className="space-y-3 rounded-2xl border bg-muted/20 p-4" aria-label={t("billing_pauses_title")}>
    <div>
      <h3 className="text-sm font-semibold">{t("billing_pauses_title")}</h3>
      <p className="text-xs text-muted-foreground">{t("billing_pauses_help")}</p>
    </div>
    {value.length > 0 && <ul className="space-y-2">
      {value.map(pause => <li key={pause.from} className="flex items-center justify-between gap-3 text-sm">
        <span>{t("billing_pauses_range", { from: formatDate(pause.from, language), to: formatDate(pause.to, language) })}</span>
        <Button type="button" size="sm" variant="ghost" aria-label={t("billing_pauses_remove", { date: formatDate(pause.from, language) })}
          onClick={() => onChange(value.filter(item => item !== pause))}>{t("delete")}</Button>
      </li>)}
    </ul>}
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1">
        <Label htmlFor="billing-pause-after">{t("billing_pauses_after")}</Label>
        <Input id="billing-pause-after" type="number" min={0} max={1200} step={1} value={after} onChange={event => setAfter(event.target.value)} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="billing-pause-duration">{t("billing_pauses_duration")}</Label>
        <Input id="billing-pause-duration" type="number" min={1} max={1200} step={1} value={duration} onChange={event => setDuration(event.target.value)} />
      </div>
    </div>
    <p className="text-xs text-muted-foreground" aria-live="polite">
      {preview.pause ? t("billing_pauses_range", { from: formatDate(preview.pause.from, language), to: formatDate(preview.pause.to, language) }) : t(preview.error)}
    </p>
    <Button type="button" variant="outline" disabled={!preview.pauses || value.length >= 24}
      onClick={() => { if (preview.pauses) onChange(preview.pauses); }}>{t("billing_pauses_add")}</Button>
  </section>;
}
