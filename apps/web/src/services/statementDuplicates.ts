import { api } from "@/lib/api";
import type { StatementDraft } from "@/lib/statements";

export interface StatementDuplicateMatch {
  kind: "installment_continuation" | "possible_duplicate";
  incoming: {
    id: string;
    name: string;
    date: string;
    currency: string;
    amount: number;
    installment: string;
    page: number;
  };
  existing: {
    id: string;
    name: string;
    date: string;
    currency: string;
    amount: number;
    installment: string;
    source: "statement" | "ledger" | "manual_card" | "manual_bill" | "incoming";
    statement_id: string;
    statement_period: string;
    card_name: string;
    page?: number;
  };
  difference: number;
}
export interface StatementDuplicateResult {
  matches: StatementDuplicateMatch[];
  has_more: boolean;
}
export const statementDuplicatesService = {
  checkFile: (fileHash: string, signal?: AbortSignal) =>
    api.post<{ exists: boolean }>("/api/statements/check-file", { file_hash: fileHash }, { signal }),
  check: (draft: StatementDraft) =>
    api.post<StatementDuplicateResult>("/api/statements/check-duplicates", draft),
};
