import { buildCostHistory, historyDelta, historyMonth, yearMonths } from "./costHistory";

describe("monthly cost history", () => {
  it("replaces a stale current snapshot with the live estimate without rewriting past months", () => {
    expect(
      buildCostHistory(
        [
          { year: 2026, month: 9, total: 100 },
          { year: 2026, month: 10, total: 0 },
        ],
        150,
        new Date(2026, 9, 17),
      ),
    ).toEqual([
      { name: "2026/09", cost: 100 },
      { name: "2026/10", cost: 150, isCurrent: true },
    ]);
  });
  it("never fills missing months with zero or compares across a gap", () => {
    const data = buildCostHistory(
      [{ year: 2026, month: 8, total: 80 }],
      100,
      new Date(2026, 9, 17),
    );
    expect(data).toHaveLength(2);
    expect(historyDelta(data[1], data[0])).toBeNull();
  });
  it("handles a year boundary and never divides a zero previous value", () => {
    expect(historyDelta({ name: "2026/01", cost: 100 }, { name: "2025/12", cost: 80 })).toEqual({
      amount: 20,
      percent: 25,
    });
    expect(historyDelta({ name: "2026/10", cost: 100 }, { name: "2026/09", cost: 0 })).toEqual({
      amount: 100,
      percent: null,
    });
  });
  it("uses real localized month names", () => {
    expect(historyMonth("2026/10", "tr", true)).toBe("Ekim 2026");
    expect(historyMonth("2026/10", "de", true)).toBe("Oktober 2026");
  });

  it("shows January to December for the selected year, preserving zero and missing months", () => {
    const data = yearMonths(
      [
        { name: "2025/08", cost: 1 },
        { name: "2025/09", cost: 90 },
        { name: "2026/01", cost: 0 },
        { name: "2026/02", cost: 120, isCurrent: true },
        { name: "2027/03", cost: 999 },
      ],
      2026,
    );
    expect(data).toHaveLength(12);
    expect(data[0]).toEqual({ name: "2026/01", cost: 0 });
    expect(data[1]).toEqual({ name: "2026/02", cost: 120, isCurrent: true });
    expect(data[11]).toEqual({ name: "2026/12", cost: null });
    expect(data.slice(2).every((point) => point.cost === null)).toBe(true);
    expect(historyMonth("2026/01", "tr", false, false)).toBe("Oca");
  });
  it("keeps older years available and lets recorded payments replace their estimates", () => {
    const history = buildCostHistory(
      [
        { year: 2024, month: 1, total: 100 },
        { year: 2025, month: 1, total: 200 },
        { year: 2026, month: 11, total: 500 },
      ],
      300,
      new Date(2026, 9, 18),
      [{ year: 2024, month: 1, total: 80 }],
    );
    expect(yearMonths(history, 2024)[0].cost).toBe(80);
    expect(yearMonths(history, 2025)[0].cost).toBe(200);
    expect(yearMonths(history, 2026)[9].cost).toBe(300);
    expect(yearMonths(history, 2026)[10].cost).toBeNull();
  });

  it("adds a next-month forecast without counting it as recorded spending or filling historical gaps", () => {
    const source = [{ name: "2026/10", cost: 100 }];
    const points = yearMonths(
      source,
      2026,
      [
        { name: "2026/11", cost: 150 },
        { name: "2026/12", cost: 175 },
      ],
      new Date(2026, 9, 18),
    );
    expect(points[9]).toEqual({ name: "2026/10", cost: 100, forecast: 100 });
    expect(points[10]).toEqual({ name: "2026/11", cost: null, forecast: 150, isForecast: true });
    expect(points[8]).toEqual({ name: "2026/09", cost: null });
    expect(points[11]).toEqual({ name: "2026/12", cost: null, forecast: 175, isForecast: true });
    expect(source).toEqual([{ name: "2026/10", cost: 100 }]);
  });

  it("keeps January's forecast visible after December, labeled with the new year", () => {
    const points = yearMonths(
      [{ name: "2026/12", cost: 100 }],
      2026,
      [{ name: "2027/01", cost: 200 }],
      new Date(2026, 11, 18),
    );
    expect(points).toHaveLength(13);
    expect(points[12]).toEqual({ name: "2027/01", cost: null, forecast: 200, isForecast: true });
  });

  it("does not attach the live forecast to a historical year", () => {
    const points = yearMonths(
      [{ name: "2025/12", cost: 100 }],
      2025,
      [{ name: "2026/11", cost: 200 }],
      new Date(2026, 9, 18),
    );
    expect(points).toHaveLength(12);
    expect(points.every((point) => point.forecast === undefined)).toBe(true);
  });

  it("can show a zero forecast without inventing past spending", () => {
    const points = yearMonths([], 2026, [{ name: "2026/11", cost: 0 }], new Date(2026, 9, 18));
    expect(points[9].forecast).toBeUndefined();
    expect(points[10]).toEqual({ name: "2026/11", cost: null, forecast: 0, isForecast: true });
  });
});
