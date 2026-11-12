export function banknoteDenominations(asset: string): readonly number[];
export function banknotesTotal(banknotes?: Record<string, number> | null): number;
export function normalizeBanknotes(asset: string, banknotes: unknown, quantity: number): Record<string, number>;
