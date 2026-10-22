export type DisplayKey = "hide_disabled";

export interface DisplayToggleDefinition {
  key: DisplayKey;
  labelKey: string;
  descriptionKey: string;
}

export const DISPLAY_TOGGLES: DisplayToggleDefinition[] = [
  {
    key: "hide_disabled",
    labelKey: "hide_disabled",
    descriptionKey: "hide_disabled_desc",
  },
];
