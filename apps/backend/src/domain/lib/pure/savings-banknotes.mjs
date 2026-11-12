const DENOMINATIONS = {
  EUR: [500, 200, 100, 50, 20, 10, 5],
  USD: [100, 50, 20, 10, 5, 2, 1],
};

export function banknoteDenominations(asset) {
  return DENOMINATIONS[asset] ?? [];
}

export function banknotesTotal(banknotes) {
  return Object.entries(banknotes ?? {}).reduce((sum, [value, count]) => sum + Number(value) * count, 0);
}

export function normalizeBanknotes(asset, banknotes, quantity) {
  if (banknotes == null) return {};
  if (typeof banknotes !== "object" || Array.isArray(banknotes)) throw Error("savings_banknotes_invalid");
  const allowed = banknoteDenominations(asset);
  const result = {};
  for (const [value, count] of Object.entries(banknotes)) {
    if (!allowed.includes(Number(value)) || String(Number(value)) !== value ||
      !Number.isSafeInteger(count) || count < 0 || count > 1e9)
      throw Error("savings_banknotes_invalid");
    if (count > 0) result[value] = count;
  }
  if (Object.keys(result).length && (!Number.isFinite(quantity) ||
    banknotesTotal(result) * 100 !== Math.round(quantity * 100)))
    throw Error("savings_banknotes_quantity_mismatch");
  return result;
}
