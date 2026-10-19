import { automaticStartDate, nextPaymentDate } from "./subscriptionStartDate";

it.each([
  ["2026-10-19", "Monthly", 1, "2026-11-19"],
  ["2026-01-31", "Monthly", 1, "2026-02-28"],
  ["2024-02-29", "Yearly", 1, "2025-02-28"],
  ["2026-10-19", "Yearly", 2, "2028-10-19"],
  ["2026-12-31", "Weekly", 2, "2027-01-14"],
  ["2026-12-31", "Daily", 1, "2027-01-01"],
])("advances a paid %s %s x%s charge by exactly one period", (date, cycle, frequency, expected) => {
  expect(nextPaymentDate(date, cycle, frequency)).toBe(expected);
});

describe("automatic tracking start", () => {
  it.each([
    ["2026-11-23", "Monthly", 1, "2026-10-23"],
    ["2026-03-31", "Monthly", 1, "2026-02-28"],
    ["2024-03-31", "Monthly", 1, "2024-02-29"],
    ["2026-11-23", "Yearly", 2, "2024-11-23"],
    ["2024-02-29", "Yearly", 1, "2023-02-28"],
    ["2026-01-01", "Weekly", 2, "2025-12-18"],
    ["2026-01-01", "Daily", 1, "2025-12-31"],
    ["2026-11-23", "Quarterly", 1, "2026-08-23"],
    ["2026-11-23", "Half-Yearly", 1, "2026-05-23"],
  ])("calculates the preceding period for %s %s x%s", (next, cycle, frequency, expected) => {
    expect(automaticStartDate(next, cycle, frequency)).toBe(expected);
  });
  it("rejects invalid schedules without inventing a date", () => {
    expect(automaticStartDate("2026-02-30", "Monthly", 1)).toBe("");
    expect(automaticStartDate("", "Monthly", 1)).toBe("");
    expect(automaticStartDate("2026-11-23", "Monthly", 0)).toBe("");
    expect(automaticStartDate("2026-11-23", "unknown", 1)).toBe("");
  });
});
