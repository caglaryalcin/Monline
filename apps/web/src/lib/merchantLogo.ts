// Match only known brand words in statement descriptors. Never guess a domain
// from a private person's name, an account number or an arbitrary merchant.
import { BILL_PROVIDER_CATALOG, findBillProvider } from "./billProviders";
const MERCHANTS: [RegExp, string, string][] = [
  [/\bboyner\b/, "boyner.com.tr", "boyner"],
  [/\b(?:bedas|bogazici elektrik dagitim)\b/, "bedas.com.tr", "bedas"],
  [/\b(?:lcw|lcwaikiki|lc waikiki)\b/, "lcw.com", "lcwaikiki"],
  [/\bikea\b/, "ikea.com.tr", "ikea"],
  [/\bjack\s*(?:and\s*)?jones\b/, "jackjones.com", "jackjones"],
  [/\bbeymen\b/, "beymen.com", "beymen"],
  [/\b(?:amazon|amzn)\b/, "amazon.com", "amazon"],
  [/\blefties\b/, "lefties.com", "lefties"],
  [/\bsuperonline\b/, "superonline.net", "superonline"],
  [/\bturkcell\b/, "turkcell.com.tr", "turkcell"],
  [/\b(?:turk telekom|turktelekom)\b/, "turktelekom.com.tr", "turktelekom"],
  [/\b(?:turknet|turk net)\b/, "turk.net", "turknet"],
  [/\bvodafone\b/, "vodafone.com.tr", "vodafone"],
  [/\bigdas\b/, "igdas.istanbul", "igdas"],
  [/\bck\s*bogazici\b/, "ckbogazici.com.tr", "ckbogazici"],
];
const LOCAL_LOGOS: Record<string, string> = {
  lcwaikiki: "lcwaikiki.svg",
  ikea: "ikea.svg",
  jackjones: "jackjones-180.png",
  amazon: "amazon.svg",
  beymen: "beymen.svg",
  turkcell: "turkcell-hq.png",
  bedas: "bedas.svg",
  ckbogazici: "ckbogazici-180.png",
  turknet: "turknet-320.png",
};
export const BILL_PROVIDERS = BILL_PROVIDER_CATALOG.map((provider) => [provider.name, provider.domain] as const);
export function merchantLogoKey(value: string) {
  return value
    .normalize("NFKD")
    .replace(/ı/g, "i")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}
export interface MerchantLogoChoice {
  id: string;
  merchant_key: string;
  merchant_name: string;
  provider_name: string;
  domain: string;
  row_id?: string;
  start_month?: string;
  scope?: "" | "from" | "month" | "year";
  updated_at?: string;
}
export interface MerchantLogoTarget {
  month?: string;
  rowId?: string;
}
export function resolveMerchantLogo(choices: MerchantLogoChoice[], name: string, target: MerchantLogoTarget = {}) {
  const key = merchantLogoKey(name);
  const candidates = choices.filter((choice) => choice.merchant_key === key &&
    (!choice.row_id || choice.row_id === target.rowId) &&
    (!choice.start_month || (!!target.month && (choice.scope === "year"
      ? choice.start_month.slice(0, 4) === target.month.slice(0, 4)
      : choice.scope === "month" ? choice.start_month === target.month : choice.start_month <= target.month))));
  const annual = candidates.filter((choice) => choice.scope === "year")
    .sort((a, b) => (b.updated_at || "").localeCompare(a.updated_at || ""))[0];
  // A whole-year selection supersedes earlier choices for that year. Later
  // monthly edits can override it without affecting the other years.
  return candidates.filter((choice) => !annual || choice.id === annual.id ||
    (choice.updated_at || "") > (annual.updated_at || ""))
    .sort((a, b) => Number(!!b.row_id) - Number(!!a.row_id) ||
      Number(b.scope === "month") - Number(a.scope === "month") ||
      (b.start_month || "").localeCompare(a.start_month || "") ||
      (b.updated_at || "").localeCompare(a.updated_at || ""))[0];
}
export function findMerchantLogo(name: string) {
  const provider = findBillProvider(name);
  if (provider) {
    const logo = provider.logoFile || LOCAL_LOGOS[provider.id];
    return { domain: provider.domain, iconSlug: provider.id,
      logoUrl: logo ? `/assets/logos/merchants/${logo}` : undefined };
  }
  const words = name
    .normalize("NFKD")
    .replace(/ı/g, "i")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ");
  const match = MERCHANTS.find(([pattern]) => pattern.test(words));
  return match
    ? {
        domain: match[1],
        iconSlug: match[2],
        logoUrl: LOCAL_LOGOS[match[2]]
          ? `/assets/logos/merchants/${LOCAL_LOGOS[match[2]]}`
          : undefined,
      }
    : undefined;
}
