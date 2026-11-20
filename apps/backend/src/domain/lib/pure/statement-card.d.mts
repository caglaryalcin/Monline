export interface StatementCardDetails {
  last_four?: string;
  expiry?: string;
  candidates?: string[];
}
export function detectStatementCard(lines: { text: string; page: number; layout_issue?: boolean }[]): StatementCardDetails;
export function validateStatementCard(value: unknown): StatementCardDetails;
export function savedStatementCard(statement: {
  card_details?: StatementCardDetails | null;
  unresolved?: { text: string; page: number }[];
  transactions?: { source?: string; page: number }[];
  excluded_transactions?: { source?: string; page: number }[];
}): StatementCardDetails;
