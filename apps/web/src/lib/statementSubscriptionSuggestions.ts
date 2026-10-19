import { findLogoService } from "@/lib/logoServices";
import { createSubscriptionMatcher } from "@/lib/statementSubscriptions";
import type { Subscription } from "@/types";

const normalize = (name: string) =>
  name
    .normalize("NFKD")
    .replace(/ı/g, "i")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
// Shared plan/product words must not link unrelated brands (e.g. Apple Music
// and YouTube Music, or NordVPN and Proton VPN).
const GENERIC = new Set([
  "premium",
  "pro",
  "plus",
  "basic",
  "standard",
  "professional",
  "business",
  "personal",
  "family",
  "individual",
  "student",
  "ultimate",
  "team",
  "teams",
  "monthly",
  "yearly",
  "annual",
  "aylik",
  "yillik",
  "abonelik",
  "aboneligi",
  "subscription",
  "subscriptions",
  "uyelik",
  "uyeligi",
  "member",
  "members",
  "membership",
  "memberships",
  "music",
  "cloud",
  "storage",
  "vpn",
  "store",
  "com",
  "www",
  "ltd",
  "inc",
  "limited",
  "payment",
  "odeme",
  "online",
  "tv",
]);
const knownService = createSubscriptionMatcher([]);

/** Suggestions only: a related brand is never silently selected or imported. */
export function statementSubscriptionSuggestions(
  serviceName: string,
  subscriptions: Subscription[],
  currencyId: string | undefined,
): Subscription[] {
  if (!currencyId) return [];
  // Ignore billing prefixes such as GOOGLE when the descriptor identifies a
  // more specific product, e.g. GOOGLE *YouTube Member.
  const detectedName = knownService(serviceName)?.service || serviceName;
  const name = normalize(detectedName);
  if (!name) return [];
  const compact = name.replace(/ /g, "");
  const logo = findLogoService(detectedName);
  const brandWords = name
    .split(" ")
    .filter((word) => word.length >= 3 && !GENERIC.has(word) && !/^\d+$/.test(word));
  return subscriptions
    .flatMap((subscription) => {
      if (subscription.record_type === "credit" || subscription.currency !== currencyId) return [];
      const candidate = normalize(subscription.name);
      const candidateLogo = findLogoService(subscription.name);
      const candidateWords = candidate
        .split(" ")
        .filter((word) => word.length >= 3 && !GENERIC.has(word) && !/^\d+$/.test(word));
      let score = 0;
      if (candidate === name || candidate.replace(/ /g, "") === compact) score = 100;
      else if (logo && candidateLogo && logo.domain === candidateLogo.domain) score = 80;
      else if (brandWords.length && candidateWords.length && brandWords[0] === candidateWords[0]) {
        const common = brandWords.filter((word) => candidateWords.includes(word)).length;
        score = 50 + common / Math.max(brandWords.length, candidateWords.length);
      }
      return score ? [{ subscription, score }] : [];
    })
    .sort((a, b) => b.score - a.score || a.subscription.name.localeCompare(b.subscription.name))
    .map(({ subscription }) => subscription);
}
