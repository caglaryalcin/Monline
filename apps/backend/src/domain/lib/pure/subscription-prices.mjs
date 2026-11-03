function field(subscription, key) {
  return typeof subscription?.get === "function" ? subscription.get(key) : subscription?.[key];
}

/** Prices are retained as a timeline; reaching a date never rewrites the base price. */
export function subscriptionPrice(subscription, date) {
  let price = Number(field(subscription, "price") || 0);
  let latest = "";
  for (const change of field(subscription, "price_changes") || []) {
    if (change.effective_date <= date && change.effective_date > latest) {
      price = change.price;
      latest = change.effective_date;
    }
  }
  return price;
}

export function validatePriceChanges(input) {
  if (input == null || input === "") return [];
  const changes = typeof input === "string" ? JSON.parse(input) : input;
  if (!Array.isArray(changes) || changes.length > 100) throw new Error("price_changes_invalid");
  const dates = new Set();
  return changes.map((change) => {
    const date = change?.effective_date;
    const parsed = typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)
      ? new Date(date + "T12:00:00Z") : null;
    if (!parsed || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date ||
        dates.has(date) || typeof change.price !== "number" || !Number.isFinite(change.price) ||
        change.price < 0 || change.price > 1e12) throw new Error("price_changes_invalid");
    dates.add(date);
    return { effective_date: date, price: change.price };
  }).sort((a, b) => a.effective_date.localeCompare(b.effective_date));
}
