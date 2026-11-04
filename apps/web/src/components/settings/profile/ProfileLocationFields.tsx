import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { holidayCountries, holidayRegions } from "@/lib/lastWeekday";

export function ProfileLocationFields({
  country,
  region,
  onCountryChange,
  onRegionChange,
  disabled,
}: {
  country: string;
  region: string;
  onCountryChange: (value: string) => void;
  onRegionChange: (value: string) => void;
  disabled?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const language = i18n.resolvedLanguage || "en";
  const countries = useMemo(() => holidayCountries(language), [language]);
  const regions = useMemo(() => holidayRegions(country, language), [country, language]);
  return (
    <div className="space-y-2">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="profile-country">{t("holiday_country")}</Label>
          <Select
            value={country || "none"}
            disabled={disabled}
            onValueChange={(value) => {
              onCountryChange(value === "none" ? "" : value);
              onRegionChange("");
            }}
          >
            <SelectTrigger id="profile-country" className="min-w-0 rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{t("holiday_country_none")}</SelectItem>
              {countries.map((item) => <SelectItem key={item.code} value={item.code}>{item.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="profile-region">{t("holiday_region")}</Label>
          <Select
            value={region || "none"}
            disabled={disabled || !country || !regions.length}
            onValueChange={(value) => onRegionChange(value === "none" ? "" : value)}
          >
            <SelectTrigger id="profile-region" className="min-w-0 rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">
                {t(!country ? "holiday_region_choose_country" : "holiday_region_nationwide")}
              </SelectItem>
              {regions.map((item) => <SelectItem key={item.code} value={item.code}>{item.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">{t("holiday_preferences_hint")}</p>
    </div>
  );
}
