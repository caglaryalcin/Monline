import type { PaymentRecord, Subscription } from "@/types";

import { categoryPeriodCosts } from "./categoryPeriodCosts";

const now = new Date(2026, 9, 17);
const monthly: Subscription = {
  id: "monthly",
  name: "Music",
  price: 10,
  currency: "usd",
  user: "u",
  frequency: 1,
  cycle: "m",
  start_date: "2025-01-01",
  next_payment: "2026-10-20",
  auto_renew: true,
  notify: false,
  notify_days_before: 0,
  inactive: false,
  expand: {
    cycle: { id: "m", name: "Monthly" },
    category: { id: "music", name: "My Music", user: "u" },
  },
};
const yearly: Subscription = {
  ...monthly,
  id: "yearly",
  name: "Storage",
  price: 1200,
  start_date: "2025-05-15",
  next_payment: "2027-05-15",
  expand: {
    cycle: { id: "y", name: "Yearly" },
    category: { id: "storage", name: "Storage", translation_key: "cloud_storage", user: "u" },
  },
};
const t = (key: string) => (key === "category_default_cloud_storage" ? "Bulut depolama" : key);

describe("category costs over a selected period", () => {
  it("uses calendar years for category payments and upcoming renewals", () => {
    const records: PaymentRecord[] = [
      {
        id: "jan",
        user: "u",
        subscription_id: monthly.id,
        due_date: "2026-01-20",
        paid_at: "2026-01-20T12:00:00",
        amount: 7,
      },
      {
        id: "old",
        user: "u",
        subscription_id: monthly.id,
        due_date: "2025-12-20",
        paid_at: "2025-12-20T12:00:00",
        amount: 900,
      },
    ];
    const paid = categoryPeriodCosts([monthly], [], 12, t, now, {
      mode: "paid",
      records,
      year: 2026,
    });
    expect(paid).toMatchObject({
      from: "2026/01",
      to: "2026/12",
      paymentCount: 1,
      data: [{ name: "My Music", value: 7, count: 1 }],
    });
    const upcoming = categoryPeriodCosts([monthly, yearly], [], 12, t, now, {
      mode: "upcoming",
      year: 2026,
    });
    expect(upcoming).toMatchObject({
      from: "2026/01",
      to: "2026/12",
      paymentCount: 3,
      data: [{ name: "My Music", value: 30, count: 3 }],
    });
  });
  it("preserves a scheduled zero amount without substituting another price", () => {
    const result = categoryPeriodCosts([{ ...monthly, price: 0 }], [], 6, t, now, {
      mode: "upcoming",
    });
    expect(result.data).toEqual([{ name: "My Music", value: 0, count: 6 }]);
    expect(result.paymentCount).toBe(6);
  });
  it("uses only recorded amounts for history, and unpaid scheduled renewals for the future", () => {
    const records: PaymentRecord[] = [
      {
        id: "paid-current",
        user: "u",
        subscription_id: monthly.id,
        due_date: "2026-10-20",
        paid_at: "2026-10-16T12:00:00",
        amount: 7,
      },
    ];
    const subscriptions: Subscription[] = [
      monthly,
      { ...monthly, id: "no-renewal", auto_renew: false, price: 9000 },
      { ...monthly, id: "inactive", inactive: true, price: 8000 },
      { ...monthly, id: "income", record_type: "credit", price: 7000 },
      {
        ...monthly,
        id: "one-time",
        auto_renew: false,
        price: 25,
        next_payment: "2026-11-10",
        expand: { ...monthly.expand, cycle: { id: "once", name: "One-Time" } },
      },
      { ...yearly, next_payment: "2027-02-15" },
      {
        ...monthly,
        id: "weekly",
        price: 2,
        end_date: "2026-10-27",
        expand: { ...monthly.expand, cycle: { id: "weekly", name: "Weekly" } },
      },
    ];
    const paid = categoryPeriodCosts(subscriptions, [], 6, t, now, { mode: "paid", records });
    expect(paid.data).toEqual([{ name: "My Music", value: 7, count: 1 }]);
    const upcoming = categoryPeriodCosts(subscriptions, [], 6, t, now, {
      mode: "upcoming",
      records,
    });
    expect(upcoming.data.reduce((total, item) => total + item.value, 0)).toBe(1279);
    expect(upcoming.paymentCount).toBe(9);
    expect(
      upcoming.categoryDetails["My Music"].find((item) => item.id === monthly.id),
    ).toMatchObject({ value: 50, count: 5 });
    expect(upcoming.categoryDetails["My Music"].map((item) => item.id).sort()).toEqual([
      "monthly",
      "one-time",
      "weekly",
    ]);
    expect(categoryPeriodCosts(subscriptions, [], 6, t, now).data).toEqual([]);
  });
  it("keeps percentage shares unchanged for fixed monthly subscriptions while period totals increase", () => {
    const other = {
      ...monthly,
      id: "other",
      price: 30,
      expand: { ...monthly.expand, category: { id: "software", name: "Software", user: "u" } },
    };
    for (const months of [1, 6, 12] as const) {
      const result = categoryPeriodCosts([monthly, other], [], months, t, now, {
        mode: "upcoming",
      });
      const total = result.data.reduce((sum, item) => sum + item.value, 0);
      expect(total).toBe(40 * months);
      expect(result.data.find((item) => item.name === "My Music")!.value / total).toBe(0.25);
      expect(result.data.find((item) => item.name === "Software")!.value / total).toBe(0.75);
    }
  });

  it("changes the actual billing window and includes yearly renewals only in their due month", () => {
    const one = categoryPeriodCosts([monthly, yearly], [], 1, t, now, { mode: "upcoming" });
    const three = categoryPeriodCosts([monthly, yearly], [], 3, t, now, { mode: "upcoming" });
    const six = categoryPeriodCosts([monthly, yearly], [], 6, t, now, { mode: "upcoming" });
    const twelve = categoryPeriodCosts([monthly, yearly], [], 12, t, now, { mode: "upcoming" });
    expect(one).toMatchObject({
      from: "2026/10",
      to: "2026/10",
      data: [{ name: "My Music", value: 10, count: 1 }],
    });
    expect(three.data).toEqual([{ name: "My Music", value: 30, count: 3 }]);
    expect(six).toMatchObject({
      from: "2026/10",
      to: "2027/03",
      data: [{ name: "My Music", value: 60, count: 6 }],
    });
    expect(twelve.from).toBe("2026/10");
    expect(twelve.to).toBe("2027/09");
    expect(twelve.data.reduce((total, item) => total + item.value, 0)).toBe(1320);
  });

  it("converts amounts to the main currency, preserves custom names, and excludes income and paused schedules", () => {
    const result = categoryPeriodCosts(
      [
        monthly,
        { ...monthly, id: "credit", record_type: "credit", price: 500 },
        { ...monthly, id: "paused", inactive: true, price: 999 },
      ],
      [{ id: "eur", code: "EUR", name: "Euro", symbol: "€", rate: 0.8, is_main: true, user: "u" }],
      3,
      t,
      now,
      { mode: "upcoming" },
    );
    expect(result.data).toEqual([{ name: "My Music", value: 24, count: 3 }]);
  });

  it("changes category shares using recorded payment dates and amounts, independently of today's schedule or price", () => {
    const record = (id: string, sub: string, paid: string, amount: number): PaymentRecord => ({
      id,
      user: "u",
      subscription_id: sub,
      due_date: paid,
      paid_at: `${paid}T12:00:00`,
      amount,
    });
    const records = [
      record("oct-music", monthly.id, "2026-10-03", 10),
      record("oct-storage", yearly.id, "2026-10-04", 90),
      record("sep-music", monthly.id, "2026-09-05", 90),
      { ...record("sep-storage", yearly.id, "2026-09-06", 10), due_date: "2026-10-06" },
      record("jul-music", monthly.id, "2026-07-07", 999),
    ];
    const subscriptions = [{ ...monthly, inactive: true, price: 9999 }, yearly];
    const one = categoryPeriodCosts(subscriptions, [], 1, t, now, { mode: "paid", records });
    const three = categoryPeriodCosts(subscriptions, [], 3, t, now, { mode: "paid", records });
    expect(one.data).toEqual([
      { name: "Bulut depolama", value: 90, count: 1 },
      { name: "My Music", value: 10, count: 1 },
    ]);
    expect(three.data).toEqual([
      { name: "Bulut depolama", value: 100, count: 2 },
      { name: "My Music", value: 100, count: 2 },
    ]);
    expect(one.paymentCount).toBe(2);
    expect(three.paymentCount).toBe(4);
    expect(one.data.find((item) => item.name === "My Music")!.value / 100).toBe(0.1);
    expect(three.data.find((item) => item.name === "My Music")!.value / 200).toBe(0.5);
  });

  it("deduplicates payments, preserves zero, and keeps unknown amounts, income and future payments out of paid totals", () => {
    const base: PaymentRecord = {
      id: "p",
      user: "u",
      subscription_id: monthly.id,
      due_date: "2026-10-05",
      paid_at: "2026-10-06T12:00:00",
      amount: 99,
    };
    const records = [
      base,
      { ...base, id: "latest", paid_at: "2026-10-07T12:00:00", amount: 20 },
      { ...base, id: "zero", due_date: "2026-10-08", amount: 0 },
      { ...base, id: "unknown", due_date: "2026-10-09", amount: undefined },
      { ...base, id: "future", due_date: "2026-10-10", paid_at: "2026-10-20T12:00:00" },
      { ...base, id: "unpaid", due_date: "2026-10-11", paid_at: undefined },
      { ...base, id: "income", subscription_id: "credit" },
      { ...base, id: "old", due_date: "2025-10-31", paid_at: "2025-10-31T12:00:00" },
    ];
    const result = categoryPeriodCosts(
      [monthly, { ...monthly, id: "credit", record_type: "credit" }],
      [],
      12,
      t,
      now,
      { mode: "paid", records },
    );
    expect(result.data).toEqual([{ name: "My Music", value: 20, count: 2 }]);
    expect(result).toMatchObject({ from: "2025/11", paymentCount: 2, unpricedCount: 1 });
    expect(categoryPeriodCosts([monthly], [], 12, t, now, { mode: "paid" }).data).toEqual([]);
  });
});
