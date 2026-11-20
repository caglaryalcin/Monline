export const STATEMENT_BANKS = {
  enpara: "Enpara",
  denizbank: "DenizBank",
  garanti: "Garanti BBVA",
} as const;
export type StatementBank = keyof typeof STATEMENT_BANKS;
