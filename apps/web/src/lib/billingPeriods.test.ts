import {
  availableBillingPresets,
  BILLING_PRESETS,
  CUSTOM_BILLING_PRESET,
  findBillingPreset,
  formatBillingPeriod,
} from "./billingPeriods";

const t = (key: string, options?: Record<string, unknown>) =>
  options?.count !== undefined ? `${key}:${options.count}` : key;

describe("billing period helpers", () => {
  it("gives every preset a unique id and a frequency of at least 1", () => {
    const ids = BILLING_PRESETS.map((preset) => preset.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(BILLING_PRESETS.every((preset) => preset.frequency >= 1)).toBe(true);
  });

  it("matches stored cycle/frequency pairs to presets, falling back to custom", () => {
    expect(findBillingPreset("Monthly", 1)).toBe("monthly");
    expect(findBillingPreset("Yearly", 2)).toBe("biennial");
    expect(findBillingPreset("Yearly", 3)).toBe("triennial");
    expect(findBillingPreset("Weekly", 2)).toBe("biweekly");
    expect(findBillingPreset("Yearly", 5)).toBe(CUSTOM_BILLING_PRESET);
    // Equivalent but not identical: kept as custom so saving does not rewrite the cycle.
    expect(findBillingPreset("Monthly", 3)).toBe(CUSTOM_BILLING_PRESET);
    expect(findBillingPreset(undefined, 1)).toBe(CUSTOM_BILLING_PRESET);
  });

  it("only offers presets whose cycle exists on this install", () => {
    const presets = availableBillingPresets([
      { id: "m", name: "Monthly" },
      { id: "y", name: "Yearly" },
    ]);
    expect(presets.map((preset) => [preset.id, preset.cycleId])).toEqual([
      ["monthly", "m"],
      ["bimonthly", "m"],
      ["yearly", "y"],
      ["biennial", "y"],
      ["triennial", "y"],
    ]);
    expect(availableBillingPresets([])).toEqual([]);
  });

  it("formats preset periods, custom multiples, and unknown cycles", () => {
    expect(formatBillingPeriod(t, "Yearly", 1)).toBe("billing_preset_yearly");
    expect(formatBillingPeriod(t, "Yearly", 3)).toBe("billing_preset_triennial");
    expect(formatBillingPeriod(t, "Yearly", 5)).toBe("billing_every_n_years:5");
    expect(formatBillingPeriod(t, "Half-Yearly", 2)).toBe("billing_every_n_half_years:2");
    expect(formatBillingPeriod(t, "Daily", 0)).toBe("billing_preset_daily");
    expect(formatBillingPeriod(t, "One-Time", 1)).toBe("one_time");
    expect(formatBillingPeriod(t, "Fortnightly", 1)).toBe("Fortnightly");
  });
});
