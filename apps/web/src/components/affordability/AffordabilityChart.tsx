import { useTranslation } from "react-i18next";
import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { useNumberLocale } from "@/hooks/useNumberLocale";
import type { PurchaseScenario } from "@/lib/affordability";
import { resolveLocale } from "@/lib/locale";
import { formatCurrency } from "@/lib/utils";

export default function AffordabilityChart({ points, currency, color }: {
  points: PurchaseScenario["points"]; currency: string; color: string;
}) {
  const { t, i18n } = useTranslation();
  const locale = useNumberLocale();
  const dateLocale = resolveLocale(i18n);
  const money = (value: number) => formatCurrency(value, currency, { locale });
  const monthLabel = (month: string) => new Intl.DateTimeFormat(dateLocale, { month: "short", year: "numeric" })
    .format(new Date(`${month}-01T12:00:00Z`));
  return <ResponsiveContainer width="100%" height="100%"><BarChart data={points} margin={{ top: 12, right: 8, bottom: 0, left: 0 }}>
    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
    <XAxis dataKey="month" tickFormatter={monthLabel} tick={{ fontSize: 11 }} />
    <YAxis width={65} tick={{ fontSize: 11 }} tickFormatter={value => new Intl.NumberFormat(locale, { notation: "compact" }).format(Number(value))} />
    <Tooltip formatter={value => money(Number(value))} labelFormatter={value => monthLabel(String(value))}
      contentStyle={{ background: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: 12 }} />
    <ReferenceLine y={0} stroke="hsl(var(--foreground))" />
    <Bar dataKey="before" name={t("aff_before")} fill="#94a3b8" radius={[4, 4, 0, 0]} />
    <Bar dataKey="after" name={t("aff_after")} fill={color} radius={[4, 4, 0, 0]} />
  </BarChart></ResponsiveContainer>;
}
