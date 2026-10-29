export type DisplayKey = "hide_disabled" | "show_currency_code";

export interface DisplayToggleDefinition {
  key: DisplayKey;
  labelKey: string;
  descriptionKey: string;
}

export const DISPLAY_TOGGLES: DisplayToggleDefinition[] = [
  {
    key: "show_currency_code",
    labelKey: "show_currency_code",
    descriptionKey: "show_currency_code_desc",
  },
  {
    key: "hide_disabled",
    labelKey: "hide_disabled",
    descriptionKey: "hide_disabled_desc",
  },
];
