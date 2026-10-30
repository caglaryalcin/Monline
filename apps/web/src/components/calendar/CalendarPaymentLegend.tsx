import { useTranslation } from "react-i18next";

import { CALENDAR_PAYMENT_TONES, paymentTone } from "./paymentAppearance";

export function CalendarPaymentLegend() {
  const { t } = useTranslation();
  return (
    <div className="shrink-0 border-t px-3 py-2 sm:px-4">
      <div
        role="group"
        aria-label={t("calendar_color_legend")}
        className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 xl:grid-cols-6"
      >
        {CALENDAR_PAYMENT_TONES.map((tone) => {
          const appearance = paymentTone(tone);
          return (
            <div
              key={tone}
              className={`${appearance.className} flex min-h-7 items-center rounded-md border px-2 py-1 text-[11px] leading-tight`}
            >
              <span>{t(appearance.labelKey)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
