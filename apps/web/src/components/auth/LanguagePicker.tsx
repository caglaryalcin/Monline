import { useTranslation } from "react-i18next";

import { LanguageLabel } from "@/components/LanguageLabel";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SUPPORTED_LANGUAGES } from "@/lib/languages";

export function LanguagePicker() {
  const { t, i18n } = useTranslation();
  const selected =
    SUPPORTED_LANGUAGES.find((language) => language.code === i18n.resolvedLanguage) ??
    SUPPORTED_LANGUAGES[0];

  return (
    <div className="flex justify-center pt-2">
      <Select value={selected.code} onValueChange={(value) => void i18n.changeLanguage(value)}>
        <SelectTrigger
          aria-label={t("language")}
          className="h-10 w-auto max-w-full gap-2.5 rounded-full px-3.5 text-xs font-medium shadow-sm [&>svg:last-child]:h-3.5 [&>svg:last-child]:w-3.5 [&>svg:last-child]:transition-transform data-[state=open]:[&>svg:last-child]:rotate-180"
        >
          <SelectValue>
            <LanguageLabel {...selected} />
          </SelectValue>
        </SelectTrigger>
        <SelectContent
          align="center"
          sideOffset={8}
          className="max-h-[min(22rem,var(--radix-select-content-available-height))] w-[min(18rem,calc(100vw-2rem))] rounded-2xl border-border/80 bg-popover p-1.5 shadow-xl shadow-black/15"
        >
          <SelectGroup>
            <SelectLabel className="px-3 pb-2 pt-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {t("language")}
            </SelectLabel>
            {SUPPORTED_LANGUAGES.map((language) => (
              <SelectItem
                key={language.code}
                value={language.code}
                textValue={language.name}
                className="my-0.5 cursor-pointer rounded-xl py-2.5 pl-8 pr-3 text-sm transition-colors data-[state=checked]:font-medium data-[highlighted]:[&>span:first-child]:text-primary-foreground [&>span:first-child]:text-primary [&>span:last-child]:w-full"
              >
                <span className="flex items-center justify-between gap-4">
                  <LanguageLabel {...language} />
                  <span
                    aria-hidden="true"
                    className="rounded-md border border-border/60 bg-background/50 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground"
                  >
                    {language.code.replace("_", "-")}
                  </span>
                </span>
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  );
}
