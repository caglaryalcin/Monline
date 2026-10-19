export type DisplayKey = "monthly_price" | "hide_disabled";

export interface DisplayToggleDefinition {
  key: DisplayKey;
  labelKey: string;
  descriptionKey: string;
}

export const DISPLAY_TOGGLES: DisplayToggleDefinition[] = [
  {
    key: "monthly_price",
    labelKey: "monthly_price",
    descriptionKey: "monthly_price_desc",
  },
  {
    key: "hide_disabled",
    labelKey: "hide_disabled",
    descriptionKey: "hide_disabled_desc",
  },
];
