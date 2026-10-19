export interface CostHistoryPoint {
  name: string;
  cost: number;
  isCurrent?: boolean;
}

export interface CostHistoryChartPoint extends Omit<CostHistoryPoint, "cost"> {
  cost: number | null;
  forecast?: number;
  isForecast?: boolean;
}

export function buildCostHistory(
  snapshots: { year: number; month: number; total: number }[],
  currentMonthly?: number,
  now = new Date(),
  payments: { year: number; month: number; total: number }[] = [],
): CostHistoryPoint[] {
  const currentKey = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}`;
  const byMonth = new Map<string, CostHistoryPoint>();
  for (const point of snapshots) {
    const key = `${point.year}/${String(point.month).padStart(2, "0")}`;
    if (point.month < 1 || point.month > 12 || key > currentKey || !Number.isFinite(point.total))
      continue;
    byMonth.set(key, { name: key, cost: Number(point.total.toFixed(2)) });
  }
  if (currentMonthly !== undefined && Number.isFinite(currentMonthly)) {
    byMonth.set(currentKey, {
      name: currentKey,
      cost: Number(currentMonthly.toFixed(2)),
      isCurrent: true,
    });
  }
  // Confirmed payments replace estimates for their month, including imports
  // for inactive subscriptions. Never add a snapshot on top of those payments.
  for (const point of payments) {
    const key = `${point.year}/${String(point.month).padStart(2, "0")}`;
    if (point.month < 1 || point.month > 12 || key > currentKey || !Number.isFinite(point.total))
      continue;
    byMonth.set(key, {
      name: key,
      cost: Number(point.total.toFixed(2)),
      ...(key === currentKey ? { isCurrent: true } : {}),
    });
  }
  return [...byMonth.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function historyDelta(current: CostHistoryPoint, previous?: CostHistoryPoint) {
  if (!previous) return null;
  const currentDate = /^(\d{4})\/(\d{2})$/.exec(current.name);
  const previousDate = /^(\d{4})\/(\d{2})$/.exec(previous.name);
  if (
    !currentDate ||
    !previousDate ||
    +currentDate[1] * 12 + +currentDate[2] - (+previousDate[1] * 12 + +previousDate[2]) !== 1
  )
    return null;
  const amount = Number((current.cost - previous.cost).toFixed(2));
  return { amount, percent: previous.cost === 0 ? null : (amount / previous.cost) * 100 };
}

/** January through December of the selected year. Null means unrecorded spending. */
export function yearMonths(
  data: CostHistoryPoint[],
  year: number,
  forecasts: CostHistoryPoint[] = [],
  now = new Date(),
): CostHistoryChartPoint[] {
  const byMonth = new Map(
    data.filter((point) => Number.isFinite(point.cost)).map((point) => [point.name, point]),
  );
  const points: CostHistoryChartPoint[] = Array.from({ length: 12 }, (_, index) => {
    const name = `${year}/${String(index + 1).padStart(2, "0")}`;
    return { name, cost: null as number | null, ...byMonth.get(name) };
  });
  if (year !== now.getFullYear()) return points;
  const currentName = `${year}/${String(now.getMonth() + 1).padStart(2, "0")}`;
  const upcoming = forecasts.filter(
    (point) =>
      Number.isFinite(point.cost) &&
      point.cost >= 0 &&
      point.name > currentName &&
      (point.name.startsWith(`${year}/`) ||
        (now.getMonth() === 11 && point.name === `${year + 1}/01`)) &&
      /^\d{4}\/(0[1-9]|1[0-2])$/.test(point.name),
  );
  if (!upcoming.length) return points;
  const current = points.find((point) => point.name === currentName)!;
  if (current.cost !== null) current.forecast = current.cost;
  for (const forecast of upcoming) {
    let target = points.find((point) => point.name === forecast.name);
    if (!target) {
      target = { name: forecast.name, cost: null };
      points.push(target);
    }
    target.cost = null;
    target.forecast = forecast.cost;
    target.isForecast = true;
  }
  return points;
}

export function historyMonth(name: string, language: string, full = false, includeYear = true) {
  const match = /^(\d{4})\/(\d{2})$/.exec(name);
  if (!match) return name;
  return new Intl.DateTimeFormat(language.replace("_", "-"), {
    month: full ? "long" : "short",
    year: includeYear ? "numeric" : undefined,
  }).format(new Date(+match[1], +match[2] - 1, 1));
}
