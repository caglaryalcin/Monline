import { matchStatementRefunds, refundMerchantName } from "@/lib/statementRefunds";
import type { ReviewTransaction, StatementLine } from "@/lib/statements";
import type { Subscription } from "@/types";

type Match = { service: string; source: "catalog" | "account" | "provider"; possible: boolean };
type AccountSubscription = Pick<Subscription, "name" | "url" | "record_type">;

// Superchat is retained in the bank statement, but does not create a recurring
// subscription or a subscription-backed calendar payment.
export function isStatementOnlyTransaction(row: {
  merchant?: string;
  subscription_service?: string;
}) {
  return [row.merchant, row.subscription_service].some((value) =>
    /\byoutube\s*super(?:\s*chat)?\b/.test(words(value || "")),
  );
}

function words(value: string) {
  return value
    .replace(/ı/g, "i")
    .replace(/\+/g, " plus ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
function phrase(text: string, value: string) {
  return ` ${text} `.includes(` ${value} `);
}

// Merchant descriptors are hints, never proof of a recurring contract. Broad
// marketplaces/processors are intentionally absent from the recognized list.
const SERVICES: [string, RegExp][] = [
  ["Netflix", /\bnetflix(?:com)?\b/],
  ["Spotify", /\bspotify\b/],
  ["Disney+", /\bdisney\s*plus\b/],
  ["YouTube Superchat", /\byoutube\s*super(?:\s*chat)?\b/],
  ["YouTube Member", /\byoutube\s*member(?:ship)?\b/],
  ["YouTube Premium", /\byoutube\s*(?:premium|music)\b/],
  ["Google One", /\bgoogle\s*(?:one|storage)\b/],
  ["Google Workspace", /\bgoogle\s*work\s*space\b|\b(?:google\s*)?g\s*suite\b/],
  ["iCloud", /\bicloud\b/],
  ["Apple Music", /\bapple\s*music\b/],
  ["Apple TV+", /\bapple\s*tv\b/],
  ["Amazon Prime", /\b(?:amazon|amzn)\s*prime(?:\s*tr)?\b|\bprime\s*video\b/],
  ["Exxen", /\bexxen\b/],
  ["MUBI", /\bmubi\b/],
  ["HBO Max", /\bhbo\s*max\b|\bblutv\b/],
  ["Deezer", /\bdeezer\b/],
  ["TIDAL", /\btidal\b/],
  ["Crunchyroll", /\bcrunchyroll\b/],
  ["TOD / beIN CONNECT", /\btod\s*tv\b|\bbein\s*connect\b/],
  ["TV+", /\btv\s*plus\b|\bturkcell\s*tv\b/],
  ["Fizy", /\bfizy\b/],
  ["Canva", /\bcanva\b/],
  ["Figma", /\bfigma\b/],
  ["Notion", /\bnotion(?:\s*labs)?\b/],
  ["Evernote", /\bevernote\b/],
  ["Dropbox", /\bdropbox\b/],
  ["pCloud", /\bpcloud\b/],
  ["Microsoft 365", /\b(?:microsoft|office|msft)\s*365\b/],
  ["Chatgpt", /\bchat\s*gpt\b/],
  ["Claude", /\bclaude\b/],
  ["GitHub Copilot", /\b(?:github\s*)?copilot\b/],
  ["1Password", /\b1password\b/],
  ["Bitwarden", /\bbitwarden\b/],
  ["LastPass", /\blastpass\b/],
  ["NordVPN", /\bnord\s*vpn\b/],
  ["Surfshark", /\bsurfshark\b/],
  ["ExpressVPN", /\bexpress\s*vpn\b/],
  ["Proton", /\bproton\s*(?:mail|vpn|pass|drive|ag)\b/],
  ["PlayStation Plus", /\b(?:playstation|psn|ps)\s*plus\b/],
  ["Xbox Game Pass", /\b(?:xbox\s*)?game\s*pass\b/],
  ["Nintendo Switch Online", /\bnintendo\s*(?:switch\s*)?online\b/],
  ["EA Play", /\bea\s*play\b/],
  ["Ubisoft+", /\bubisoft\s*plus\b/],
  ["GeForce NOW", /\bgeforce\s*now\b/],
  ["Faceit", /\bfaceit(?:\s*(?:premium|plus|subscription))?\b/],
  ["Supercell Store", /\bsupercell\s*store\b|\bstore\s*supercell(?:\s*com)?\b/],
  ["Duolingo", /\bduolingo\b/],
  ["Coursera Plus", /\bcoursera\s*plus\b/],
  ["LinkedIn Premium", /\blinkedin\s*premium\b/],
];

// These billing descriptors can also represent one-off purchases or usage.
// They stay unselected until the user confirms that they are subscriptions.
const PROVIDERS: [string, RegExp][] = [
  ["Apple", /\bapple\s*com\s*bill\b|\bitunes(?:\s*com\s*bill)?\b/],
  ["Google Play", /\bgoogle\s*(?:play|services)\b/],
  ["YouTube", /\byoutube\b/],
  ["Microsoft", /\b(?:msft|microsoft)\b/],
  ["Adobe", /\badobe\b/],
  ["OpenAI", /\bopenai\b/],
  ["Anthropic", /\banthropic\b/],
  ["GitHub", /\bgithub\b/],
  ["Cloudflare", /\bcloudflare\b/],
  ["DigitalOcean", /\bdigital\s*ocean\b/],
  ["Hetzner", /\bhetzner\b/],
  ["Vercel", /\bvercel\b/],
  ["Netlify", /\bnetlify\b/],
  ["AWS", /\baws\b|\bamazon\s*web\s*services\b/],
];
const GENERIC_NAMES = new Set([
  "google",
  "apple",
  "microsoft",
  "amazon",
  "amzn",
  "market",
  "alisveris",
  "shopping",
  "abonelik",
  "subscription",
  "subscriptions",
  "aylik",
  "yillik",
  "monthly",
  "yearly",
  "internet",
  "telefon",
  "fatura",
  "kira",
  "rent",
  "diger",
  "other",
  "odeme",
  "payment",
  "iyzico",
  "paytr",
  "paddle",
  "stripe",
  "paypal",
  "shopier",
  "payu",
  "iyzi",
  "fastspring",
]);
const NON_SUBSCRIPTION =
  /\b(?:migros|bim|sok|a101|carrefoursa|carrefour|trendyol|hepsiburada|n11|getir|yemeksepeti|shell|opet|petrol|akaryakit|benzin|restoran|restaurant|market|supermarket|nakit\s*avans|kart\s*borcu|kart\s*odemesi|odemeniz|kredi\s*karti\s*odeme)\b/;
const ONE_OFF =
  /\b(?:gift\s*card|hediye\s*kart\w*|tek\s*sefer\w*|one\s*time|top\s*up|bakiye\s*yukle\w*|steam|epic\s*games)\b/;
const SHARED_HOSTS =
  /(?:^|\.)(?:google|apple|amazon|microsoft|iyzico|paytr|paddle|stripe|paypal|shopier|fastspring)\./;

function accountAliases(subscription: AccountSubscription) {
  const aliases = [words(subscription.name)];
  if (subscription.url) {
    try {
      const host = new URL(
        /^https?:\/\//i.test(subscription.url) ? subscription.url : `https://${subscription.url}`,
      ).hostname.toLowerCase();
      if (!SHARED_HOSTS.test(host)) {
        aliases.push(words(host.replace(/^www\./, "")));
        aliases.push(
          ...host
            .split(".")
            .filter(
              (part) =>
                part.length >= 4 && !["online", "cloud", "store", "shop", "hosting"].includes(part),
            )
            .map(words),
        );
      }
    } catch {
      /* A malformed optional URL must not prevent statement extraction. */
    }
  }
  return aliases.filter((alias) => alias.length >= 4 && !GENERIC_NAMES.has(alias));
}

export function createSubscriptionMatcher(subscriptions: AccountSubscription[]) {
  const accounts = subscriptions
    .filter((subscription) => subscription.record_type !== "credit")
    .map((subscription) => ({ subscription, aliases: accountAliases(subscription) }));
  return (description: string): Match | null => {
    const text = words(description);
    if (
      NON_SUBSCRIPTION.test(text) ||
      ONE_OFF.test(text) ||
      /\b(?:iade\w*|iptal\w*|refund\w*|reversal\w*|alacak\w*)\b/.test(text)
    )
      return null;
    const service = SERVICES.find(([, pattern]) => pattern.test(text));
    if (service) return { service: service[0], source: "catalog", possible: false };
    const provider = PROVIDERS.find(([, pattern]) => pattern.test(text));
    // Do not let a generic account name make Apple/Google/other store purchases certain.
    if (provider) return { service: provider[0], source: "provider", possible: true };
    const account = accounts.find(({ aliases }) => aliases.some((alias) => phrase(text, alias)));
    if (account) return { service: account.subscription.name, source: "account", possible: true };
    return null;
  };
}

export function filterSubscriptionTransactions(
  rows: ReviewTransaction[],
  match: ReturnType<typeof createSubscriptionMatcher>,
) {
  const transactions: ReviewTransaction[] = [];
  const { cancelledIds, refundedChargeIds, unmatchedRefunds } = matchStatementRefunds(rows);
  let excluded = 0;
  let refunded = 0;
  for (const row of rows) {
    if (cancelledIds.has(row.id) || refundedChargeIds.has(row.id)) {
      excluded++;
      if (row.kind === "charge" && match(row.merchant)) refunded++;
      continue;
    }
    if (row.kind !== "charge") {
      excluded++;
      continue;
    }
    const detected = match(row.merchant);
    if (!detected) {
      excluded++;
      continue;
    }
    transactions.push({
      ...row,
      subscription_service: detected.service,
      subscription_match: detected.source,
      uncertain: row.uncertain || detected.possible,
      included: row.included && !detected.possible,
    });
  }
  return {
    transactions,
    excluded,
    refunded,
    unmatchedRefunds: unmatchedRefunds.filter((row) => match(refundMerchantName(row.merchant)))
      .length,
  };
}

export function filterSubscriptionLines(
  lines: StatementLine[],
  match: ReturnType<typeof createSubscriptionMatcher>,
) {
  return lines.filter((line) => match(line.text));
}
