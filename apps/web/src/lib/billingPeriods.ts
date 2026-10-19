import type { Cycle } from "@/types";

import { ONE_TIME_CYCLE } from "./recordTypes";

/**
 * Common billing periods offered as one-click presets in the subscription form.
 * Each preset is just a (cycle, frequency) pair, so no backend changes are
 * needed: "every 3 years" is stored as the Yearly cycle with frequency 3.
 * Anything not listed here stays reachable through the custom option.
 */
export const BILLING_PRESETS = [
  { id: "daily", cycle: "Daily", frequency: 1 },
  { id: "weekly", cycle: "Weekly", frequency: 1 },
  { id: "biweekly", cycle: "Weekly", frequency: 2 },
  { id: "every_4_weeks", cycle: "Weekly", frequency: 4 },
  { id: "monthly", cycle: "Monthly", frequency: 1 },
  { id: "bimonthly", cycle: "Monthly", frequency: 2 },
  { id: "quarterly", cycle: "Quarterly", frequency: 1 },
  { id: "half_yearly", cycle: "Half-Yearly", frequency: 1 },
  { id: "yearly", cycle: "Yearly", frequency: 1 },
  { id: "biennial", cycle: "Yearly", frequency: 2 },
  { id: "triennial", cycle: "Yearly", frequency: 3 },
] as const;

export type BillingPreset = (typeof BILLING_PRESETS)[number];
export type BillingPresetId = BillingPreset["id"];

export const CUSTOM_BILLING_PRESET = "custom";

/** i18n key suffix for "every N <unit>" labels, per cycle name. */
const CYCLE_UNIT_KEYS: Record<string, string> = {
  Daily: "days",
  Weekly: "weeks",
  Monthly: "months",
  Quarterly: "quarters",
  "Half-Yearly": "half_years",
  Yearly: "years",
};

/** i18n key of each cycle's own name, used in the custom cycle select. */
export const CYCLE_NAME_KEYS: Record<string, string> = {
  Daily: "daily",
  Weekly: "weekly",
  Monthly: "monthly",
  Quarterly: "quarterly",
  "Half-Yearly": "half_yearly",
  Yearly: "yearly",
  [ONE_TIME_CYCLE]: "one_time",
};

type Translate = (key: string, options?: Record<string, unknown>) => string;

/**
 * Presets whose cycle exists on this install (older databases may lack some),
 * each paired with that cycle's record id.
 */
export function availableBillingPresets(
  cycles: Pick<Cycle, "id" | "name">[],
): (BillingPreset & { cycleId: string })[] {
  const idsByName = new Map(cycles.map((c) => [c.name as string, c.id]));
  return BILLING_PRESETS.flatMap((preset) => {
    const cycleId = idsByName.get(preset.cycle);
    return cycleId ? [{ ...preset, cycleId }] : [];
  });
}

/** The preset matching a stored cycle/frequency pair, or "custom" when none does. */
export function findBillingPreset(
  cycleName: string | undefined,
  frequency: number,
): BillingPresetId | typeof CUSTOM_BILLING_PRESET {
  const match = BILLING_PRESETS.find(
    (preset) => preset.cycle === cycleName && preset.frequency === frequency,
  );
  return match?.id ?? CUSTOM_BILLING_PRESET;
}

/** Human label for a billing period, e.g. "Every 2 years" or "Quarterly". */
export function formatBillingPeriod(t: Translate, cycleName: string, frequency: number): string {
  const freq = Math.max(1, frequency || 1);
  const preset = findBillingPreset(cycleName, freq);
  if (preset !== CUSTOM_BILLING_PRESET) return t(`billing_preset_${preset}`);

  const unit = CYCLE_UNIT_KEYS[cycleName];
  if (unit) return t(`billing_every_n_${unit}`, { count: freq });

  const nameKey = CYCLE_NAME_KEYS[cycleName];
  return nameKey ? t(nameKey) : cycleName;
}
