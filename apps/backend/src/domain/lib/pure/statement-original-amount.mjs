// Original-currency references are distinct from the supported posted ledger
// currencies. Keep this shared by the browser parser and server matcher.
const codes = new Set(("AED AFN ALL AMD ANG AOA ARS AUD AWG AZN BAM BBD BDT BGN BHD BIF BMD BND BOB BRL BSD BTN BWP BYN BZD CAD CDF CHF CLP CNY COP CRC CUC CUP CVE CZK DJF DKK DOP DZD EGP ERN ETB EUR FJD FKP GBP GEL GHS GIP GMD GNF GTQ GYD HKD HNL HRK HTG HUF IDR ILS INR IQD IRR ISK JMD JOD JPY KES KGS KHR KMF KPW KRW KWD KYD KZT LAK LBP LKR LRD LSL LYD MAD MDL MGA MKD MMK MNT MOP MRU MUR MVR MWK MXN MYR MZN NAD NGN NIO NOK NPR NZD OMR PAB PEN PGK PHP PKR PLN PYG QAR RON RSD RUB RWF SAR SBD SCR SDG SEK SGD SHP SLE SLL SOS SRD SSP STN SVC SYP SZL THB TJS TMT TND TOP TRY TTD TWD TZS UAH UGX USD UYU UZS VES VND VUV WST XAF XCD XCG XDR XOF XPF XSU YER ZAR ZMW ZWG ZWL").split(" "));
const aliases = { TL: "TRY", "₺": "TRY", "$": "USD", "€": "EUR", "£": "GBP" };
const number = String.raw`(?:\d{1,3}(?:\.\d{3})+,\d{2}|\d{1,3}(?:,\d{3})+\.\d{2}|\d{1,3}(?:[ \u00a0\u202f\u2007]\d{3})+[,.]\d{2}|\d+[,.]\d{2})`;
const currency = String.raw`[A-Z]{3}|TL|₺|\$|€|£`;
const pattern = new RegExp(String.raw`^\s*(?:(${currency})\s*)?(${number})(?:\s*(${currency}))?\s*$`, "i");

export function parseStatementOriginalAmount(value) {
  const text = String(value || "")
    .replace(/ı/g, "i").normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/^\s*(?:islem tutari|islem toplami|toplam islem tutari|alisveris tutari|alisveris toplami|transaction amount|purchase amount|total purchase amount)\s*:\s*/i, "");
  const match = text.match(pattern);
  if (!match || (!match[1] && !match[3])) return null;
  const normalize = (code) => code ? aliases[code.toUpperCase()] || code.toUpperCase() : null;
  const prefix = normalize(match[1]), suffix = normalize(match[3]);
  if ((prefix && !codes.has(prefix)) || (suffix && !codes.has(suffix)) || (prefix && suffix && prefix !== suffix)) return null;
  const digits = match[2].replace(/[ \u00a0\u202f\u2007]/g, "");
  const cents = Number(digits.slice(0, -3).replace(/[.,]/g, "")) * 100 + Number(digits.slice(-2));
  if (!Number.isSafeInteger(cents) || cents <= 0 || cents > 10000000000) return null;
  return { amount: cents / 100, currency: suffix || prefix };
}
