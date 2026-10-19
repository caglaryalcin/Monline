import { renderHook } from "@testing-library/react";

import type { User } from "@/types";

import { useDashboardDerivedData } from "./useDashboardDerivedData";

function getUser(overrides: Partial<User> = {}): User {
  return {
    id: "user-1",
    email: "daniel@example.com",
    username: "daniel",
    name: "Daniel",
    ...overrides,
  };
}

describe("useDashboardDerivedData", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 1, 15));
  });
  afterEach(() => vi.useRealTimers());
  it("keeps all paid years selectable and ignores estimated snapshots and current subscription prices", () => {
    const paymentCosts = Array.from({ length: 14 }, (_, index) => ({
      year: 2025 + Math.floor(index / 12),
      month: (index % 12) + 1,
      total: 10 + index + 0.456,
    }));

    const { result } = renderHook(() =>
      useDashboardDerivedData({
        user: getUser({ budget: 200 }),
        summary: { totalMonthly: 80 },
        paymentCosts,
        yearlyCosts: [{ year: 2024, month: 1, total: 99999 }],
      }),
    );

    expect(result.current.chartData).toHaveLength(14);
    expect(result.current.chartData[0]).toEqual({ name: "2025/01", cost: 10.46 });
    expect(result.current.chartData.at(-1)).toEqual({
      name: "2026/02",
      cost: 23.46,
      isCurrent: true,
    });
    expect(result.current.budget).toBe(200);
    expect(result.current.budgetUsed).toBe(40);
    expect(result.current.isOverBudget).toBe(false);
  });

  it("does not fill unrecorded spending with estimated costs", () => {
    const { result } = renderHook(() =>
      useDashboardDerivedData({
        user: getUser(),
        summary: { totalMonthly: 5000 },
        yearlyCosts: [{ year: 2026, month: 1, total: 9000 }],
        paymentCosts: [],
      }),
    );
    expect(result.current.chartData).toEqual([]);
  });

  it("caps budget usage at 100 and marks over-budget state", () => {
    const { result } = renderHook(() =>
      useDashboardDerivedData({
        user: getUser({ budget: 50 }),
        summary: { totalMonthly: 80 },
        yearlyCosts: [],
      }),
    );

    expect(result.current.budgetUsed).toBe(100);
    expect(result.current.isOverBudget).toBe(true);
  });

  it("returns zeroed budget usage when budget or summary is missing", () => {
    const { result } = renderHook(() =>
      useDashboardDerivedData({
        user: undefined,
        summary: undefined,
        yearlyCosts: undefined,
      }),
    );

    expect(result.current.budget).toBe(0);
    expect(result.current.budgetUsed).toBe(0);
    expect(result.current.chartData).toEqual([]);
    expect(result.current.isOverBudget).toBe(false);
  });

  it("adds current-month credits to available spending power", () => {
    const { result } = renderHook(() =>
      useDashboardDerivedData({
        user: getUser({ budget: 100 }),
        summary: { totalMonthly: 120, totalCredits: 50 },
        yearlyCosts: [],
      }),
    );

    expect(result.current.totalCredits).toBe(50);
    expect(result.current.remaining).toBe(30);
    expect(result.current.budgetUsed).toBe(80);
    expect(result.current.isOverBudget).toBe(false);
  });

  it("does not flag an account with no budget and no credits as over budget", () => {
    const { result } = renderHook(() =>
      useDashboardDerivedData({
        user: getUser({ budget: 0 }),
        summary: { totalMonthly: 120, totalCredits: 0 },
        yearlyCosts: [],
      }),
    );

    // There is nothing to be "over": the user never set a ceiling.
    expect(result.current.remaining).toBe(-120);
    expect(result.current.isOverBudget).toBe(false);
  });

  it("flags over budget once there is a budget or a credit to measure against", () => {
    const { result } = renderHook(() =>
      useDashboardDerivedData({
        user: getUser({ budget: 0 }),
        summary: { totalMonthly: 120, totalCredits: 50 },
        yearlyCosts: [],
      }),
    );

    expect(result.current.remaining).toBe(-70);
    expect(result.current.isOverBudget).toBe(true);
  });
});
