import fs from "node:fs";

import { render, screen } from "@testing-library/react";

import { StatisticsPaymentDates } from "@/components/statistics/StatisticsPaymentDates";
import { findLogoService } from "@/lib/logoServices";
import { buildPaymentStatistics } from "@/lib/paymentStatistics";
import { withStandalonePayments } from "@/lib/standalonePayments";
import { automaticLogoUrls } from "@/lib/subscriptionLogo";
import type { PaymentRecord, Subscription } from "@/types";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, args?: { count: number }) => (({
      statistics_payment_dates: "Ödeme tarihi",
      statistics_scheduled_payment_dates: "Planlanan ödeme tarihi",
      payments_count: `${args?.count} ödeme`,
    } as Record<string, string>)[key] ?? key),
  }),
}));

const sub: Subscription = {
  id: "subscription", user: "user", name: "Youtube testasd", brand_name: "YouTube",
  price: 10, currency: "", cycle: "monthly", frequency: 1, auto_renew: true,
  next_payment: "2026-11-01", start_date: "2026-01-01", inactive: false,
  notify: false, notify_days_before: 0, expand: { cycle: { id: "monthly", name: "Monthly" } },
};
const now = new Date(2026, 9, 17, 12);
const payment = (id: string, due: string, paid: string, amount: number): PaymentRecord => ({
  id, subscription_id: sub.id, user: sub.user, due_date: due,
  paid_at: `${paid}T12:00:00`, auto_paid: false, amount,
});

describe("#20 Thalia", () => {
  it.each(["Thalia", "Thalia Hörbuch-Abo", "Thalia Hör-Flat", "Thalia Lese-Flat", "www.thalia.de"])("resolves %s to the bundled brand symbol", (name) => {
    expect(findLogoService(name)?.domain).toBe("thalia.de");
    const logo = automaticLogoUrls({ name })[0];
    expect(logo).toBe("/assets/logos/thalia.svg");
    expect(fs.readFileSync(`public${logo}`, "utf8")).toContain('<title>Thalia</title>');
  });
});

describe("#23 separate brand and display name", () => {
  it("uses the explicit brand while keeping the display name unchanged", () => {
    const item = { name: "Youtube testasd", brand_name: " YouTube ", url: "https://netflix.com" };
    expect(automaticLogoUrls(item)).toContain("https://icon.horse/icon/youtube.com");
    expect(automaticLogoUrls(item).join()).not.toContain("netflix");
    expect(item.name).toBe("Youtube testasd");
  });
  it("uses the previous name behavior when brand is blank", () => {
    expect(automaticLogoUrls({ name: "YouTube", brand_name: " " })).toContain("https://icon.horse/icon/youtube.com");
    expect(automaticLogoUrls({ name: "Youtube testasd", brand_name: "" })).toEqual([]);
  });
  it.each(["iCloud+ 200GB", "iCloud+ 2 TB"])("recognizes capacity-qualified name %s", (name) => {
    expect(findLogoService(name)?.domain).toBe("icloud.com");
  });
  it("retains the brand on standalone payments", () => {
    const record = { ...payment("standalone", "2026-10-01", "2026-10-01", 10), subscription_id: "", name: "XYZ channel", brand_name: "Twitch", currency: "" };
    expect(withStandalonePayments([], [record], [])[0]).toMatchObject({ name: "XYZ channel", brand_name: "Twitch" });
  });
});

describe("#22 payment dates", () => {
  it("keeps actual paid dates, duplicate days and zero payments without changing totals", () => {
    const records = [
      payment("one", "2026-09-01", "2026-10-03", 10),
      payment("two", "2026-10-01", "2026-10-06", 25),
      payment("three", "2026-10-02", "2026-10-06", 0),
    ];
    const month = buildPaymentStatistics([sub], [], records, now, 12, 12, 2026).paid[9];
    expect(month).toMatchObject({ total: 35, count: 3 });
    expect(month.subscriptions[0]).toMatchObject({ dates: ["2026-10-03", "2026-10-06", "2026-10-06"], amount: 35, count: 3 });
    render(<StatisticsPaymentDates dates={month.subscriptions[0].dates} language="tr" upcoming={false} />);
    expect(screen.getByText("Ödeme tarihi:")).toBeInTheDocument();
    expect([...document.querySelectorAll("time")].map(item => item.dateTime)).toEqual(["2026-10-03", "2026-10-06"]);
    expect(screen.getByText("×2")).toHaveAccessibleName("2 ödeme");
  });
  it("retains all upcoming dates, not just the first one", () => {
    const weekly = { ...sub, cycle: "weekly", expand: { cycle: { id: "weekly", name: "Weekly" as const } } };
    const month = buildPaymentStatistics([weekly], [], [], now, 12, 12, 2026).upcoming[10];
    expect(month.subscriptions[0].dates?.length).toBe(month.count);
    expect(month.count).toBeGreaterThan(1);
    expect(month.subscriptions[0].dates?.every(date => date.startsWith("2026-11-"))).toBe(true);
    render(<StatisticsPaymentDates dates={month.subscriptions[0].dates} language="tr" upcoming />);
    expect(screen.getByText("Planlanan ödeme tarihi:")).toBeInTheDocument();
  });
});
