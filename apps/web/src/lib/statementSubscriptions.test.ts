import { describe, expect, it } from "vitest";

import { parseStatement } from "./statements";
import {
  createSubscriptionMatcher,
  filterSubscriptionTransactions,
} from "./statementSubscriptions";

describe("statement service names", () => {
  const match = createSubscriptionMatcher([]);
  it.each([
    "Google Workspace_cagla",
    "GOOGLE *WORKSPACE_CAGLA",
    "GoogleWorkspace_cagla",
    "GOOGLE WORK SPACE",
    "GOOGLE *GSUITE_cagla",
    "G Suite",
  ])("detects %s as Google Workspace", (merchant) => {
    expect(match(merchant)).toEqual({
      service: "Google Workspace",
      source: "catalog",
      possible: false,
    });
  });
  it.each(["WORKSPACE OFIS MOBILYA", "GOOGLE ADS", "Google WorkspaceShop"])(
    "does not classify %s as a Google Workspace subscription",
    (merchant) => {
      expect(match(merchant)).toBeNull();
    },
  );
  it("keeps the screenshot's Workspace charge with its exact payment date and amount", () => {
    const parsed = parseStatement(
      [
        { page: 1, text: "01/09/2026 Google Workspace_cagla 223,70 TL" },
        { page: 1, text: "02/09/2026 WORKSPACE OFIS MOBILYA 999,00 TL" },
      ],
      "2026-09",
    );
    const result = filterSubscriptionTransactions(parsed.transactions, match);
    expect(result.transactions).toEqual([
      expect.objectContaining({
        date: "2026-09-01",
        amount: 223.7,
        currency: "TRY",
        kind: "charge",
        subscription_service: "Google Workspace",
        subscription_match: "catalog",
        included: true,
        uncertain: false,
      }),
    ]);
    expect(result.excluded).toBe(1);
  });
  it.each(["OPENAI *CHATGPT SUBSCR", "ChatGPT Plus", "CHAT GPT SUBSCRIPTION"])(
    "detects %s as Chatgpt",
    (merchant) => {
      expect(match(merchant)).toEqual({ service: "Chatgpt", source: "catalog", possible: false });
    },
  );
  it.each(["FACEIT", "FACEIT PREMIUM", "FACEIT PLUS"])("detects %s as Faceit", (merchant) => {
    expect(match(merchant)?.service).toBe("Faceit");
  });
  it("keeps generic OpenAI billing separate because it may be API usage", () => {
    expect(match("OPENAI API")).toEqual({ service: "OpenAI", source: "provider", possible: true });
  });
  it.each([
    "IYZICO/AmazonPrimeTR ISTANBUL TR",
    "IYZICO/AMAZON PRIME TR",
    "AmazonPrimeTR",
    "AMZNPRIMETR",
    "AMAZON PRIME",
    "AMZN PRIME",
    "Prime Video",
  ])("detects %s as Amazon Prime", (merchant) => {
    expect(match(merchant)).toEqual({
      service: "Amazon Prime",
      source: "catalog",
      possible: false,
    });
  });
  it.each([
    "IYZICO/Amazon.com.tr ISTANBUL TR",
    "AMAZON MARKETPLACE",
    "AMZN Mktp",
    "IYZICO/OTHER MERCHANT",
    "AmazonPrimeTrader",
  ])("does not treat %s as an Amazon Prime subscription", (merchant) => {
    expect(match(merchant)).toBeNull();
  });
  it("retains the Prime charge from the statement with its date, amount and currency", () => {
    const { transactions } = parseStatement(
      [
        { page: 1, text: "23/09/2026 IYZICO/AmazonPrimeTR ISTANBUL TR 69,90 TL" },
        { page: 1, text: "24/09/2026 IYZICO/Amazon.com.tr ISTANBUL TR 299,90 TL" },
      ],
      "2026-09",
    );
    const filtered = filterSubscriptionTransactions(transactions, match);
    expect(filtered.transactions).toEqual([
      expect.objectContaining({
        date: "2026-09-23",
        amount: 69.9,
        currency: "TRY",
        kind: "charge",
        subscription_service: "Amazon Prime",
        subscription_match: "catalog",
        included: true,
        uncertain: false,
      }),
    ]);
    expect(filtered.excluded).toBe(1);
  });
});
