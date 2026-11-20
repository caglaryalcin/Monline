import { Globe2 } from "lucide-react";

const CURRENCY_COUNTRIES: Record<string, string> = {
  TRY: "tr", USD: "us", EUR: "eu", GBP: "gb", CHF: "ch", CAD: "ca", AUD: "au", NZD: "nz", JPY: "jp", CNY: "cn",
  SEK: "se", NOK: "no", DKK: "dk", RUB: "ru", AED: "ae", SAR: "sa", KWD: "kw", QAR: "qa", BHD: "bh", OMR: "om",
  ZAR: "za", INR: "in", PKR: "pk", BDT: "bd", LKR: "lk", NPR: "np", IDR: "id", MYR: "my", PHP: "ph", THB: "th",
  VND: "vn", KRW: "kr", HKD: "hk", SGD: "sg", TWD: "tw", BRL: "br", MXN: "mx", ARS: "ar", CLP: "cl", COP: "co",
  PEN: "pe", UYU: "uy", CRC: "cr", HUF: "hu", PLN: "pl", CZK: "cz", RON: "ro", BGN: "bg", ISK: "is", ALL: "al",
  BAM: "ba", RSD: "rs", MKD: "mk", GEL: "ge", AZN: "az", UAH: "ua", MDL: "md", DZD: "dz", EGP: "eg", MAD: "ma",
  TND: "tn", LYD: "ly", IQD: "iq", ILS: "il", LBP: "lb", SYP: "sy", IRR: "ir", KZT: "kz", UZS: "uz", KGS: "kg",
  TJS: "tj", AFN: "af", NAD: "na", NGN: "ng", KES: "ke", GHS: "gh", TZS: "tz", UGX: "ug", ETB: "et", ZMW: "zm",
  BWP: "bw", MUR: "mu", SCR: "sc", MGA: "mg",
};

export const FLAG_CURRENCY_CODES = Object.keys(CURRENCY_COUNTRIES).sort();

export function CurrencyFlag({ code }: { code: string }) {
  const country = CURRENCY_COUNTRIES[code.trim().toUpperCase()];
  return country ? <img src={`/assets/flags/${country}.svg`} width={24} height={16} alt="" aria-hidden="true" className="h-4 w-6 shrink-0 rounded-[3px] object-cover ring-1 ring-inset ring-foreground/10" /> : <Globe2 aria-hidden="true" className="h-4 w-6 shrink-0 text-muted-foreground" />;
}

export function CurrencyLabel({ code, symbol }: { code: string; symbol?: string }) {
  return <span className="inline-flex items-center gap-2.5 whitespace-nowrap">
    <CurrencyFlag code={code} />
    <span>{symbol && symbol !== code ? `${code} (${symbol})` : code}</span>
  </span>;
}
