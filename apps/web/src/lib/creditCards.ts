import { STATEMENT_BANKS, type StatementBank } from "@/lib/statementBanks";
import type { SavedStatement } from "@/lib/statements";

export interface CreditCard {
  id: string;
  bank: string;
  name: string;
  last_four: string;
  expiry: string;
  network?: "" | "visa" | "mastercard";
  statement_day?: number;
  statement_weekend_adjust?: boolean;
  created: string;
  statement_count: number;
}
export type CreditCardInput = Pick<CreditCard, "bank" | "name" | "last_four" | "expiry" | "statement_day" | "statement_weekend_adjust" | "network">;
export interface CreditCardsData {
  cards: CreditCard[];
  unassigned_count: number;
  total_count: number;
}
export type CardStatement = Pick<SavedStatement, "id" | "bank" | "period" | "file_name" | "file_hash" | "credit_card" | "card_details">;
export const creditCardsKey = (userId: string) => ["credit-cards", userId] as const;
export const unassignedStatementsKey = (userId: string) => ["bank-statements", userId, "unassigned"] as const;
export function supportedCardBank(bank: string): StatementBank | "" {
  const key = bank.toLowerCase().replace(/[^a-z]/g, "");
  if (key === "enpara" || key === "denizbank" || key === "garanti") return key;
  return key === "garantibbva" ? "garanti" : "";
}
export function cardBankName(bank: string) {
  const key = supportedCardBank(bank);
  return key ? STATEMENT_BANKS[key] : bank;
}
export function creditCardLabel(card: Pick<CreditCard, "bank" | "last_four" | "name">) {
  return `${cardBankName(card.bank)} · •••• ${card.last_four}${card.name ? ` · ${card.name}` : ""}`;
}
