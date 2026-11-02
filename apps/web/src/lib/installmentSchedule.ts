import type { InstallmentPlan, SpendingData } from "@/lib/spending";

export interface ScheduledInstallment extends InstallmentPlan {
  source_period: string;
  projected: boolean;
}

const monthIndex = (month: string) =>
  /^\d{4}-(0[1-9]|1[0-2])$/.test(month)
    ? Number(month.slice(0, 4)) * 12 + Number(month.slice(5, 7)) - 1
    : null;
const monthName = (index: number) =>
  `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
const normalize = (name: string) =>
  name.normalize("NFKC").trim().toLocaleLowerCase("tr").replace(/\s+/g, " ");

/** Keep statement snapshots; extend each purchase's latest snapshot to its final installment. */
export function installmentSchedule(
  data: Pick<SpendingData, "installments" | "events">,
  currentMonth: string,
) {
  const sourceBanks = new Map(
    data.events
      .filter((event) => event.statement_id && event.bank)
      .map((event) => [event.statement_id!, event.bank!]),
  );
  const cohorts = new Map<string, Map<string, InstallmentPlan[]>>();
  const seen = new Set<string>();
  const result: ScheduledInstallment[] = [];
  for (const plan of data.installments) {
    const index = monthIndex(plan.period);
    if (
      seen.has(plan.id) ||
      index == null ||
      !Number.isInteger(plan.current) ||
      !Number.isInteger(plan.total) ||
      plan.current < 1 ||
      plan.current > plan.total ||
      plan.total > 999 ||
      !Number.isFinite(plan.amount) ||
      plan.amount < 0
    )
      continue;
    seen.add(plan.id);
    result.push({ ...plan, source_period: plan.period, projected: false });
    const bank = sourceBanks.get(plan.statement_id) || "";
    const card = plan.card_name
      ? `${bank}:${normalize(plan.card_name)}`
      : plan.row_id || bank || plan.statement_id;
    // The first installment month distinguishes repeated purchases from the same merchant.
    const key = JSON.stringify([
      card,
      normalize(plan.name),
      plan.currency,
      plan.total,
      index - plan.current + 1,
    ]);
    const months = cohorts.get(key) ?? new Map<string, InstallmentPlan[]>();
    const plans = months.get(plan.period) ?? [];
    // Duplicate PDFs for a card/month must not duplicate its future obligations.
    if (!plans.length || plans[0].statement_id === plan.statement_id) plans.push(plan);
    months.set(plan.period, plans);
    cohorts.set(key, months);
  }
  for (const months of cohorts.values()) {
    // Match multiple same-merchant purchases as a multiset, retaining equal purchases.
    const snapshots = new Map<number, InstallmentPlan[]>();
    for (const [, plans] of [...months].sort(([a], [b]) => a.localeCompare(b)))
      [...plans]
        .sort((a, b) => a.amount - b.amount || a.id.localeCompare(b.id))
        .forEach((plan, slot) => snapshots.set(slot, [...(snapshots.get(slot) ?? []), plan]));
    for (const plans of snapshots.values()) {
      for (const [snapshot, plan] of plans.entries()) {
        const sourceIndex = monthIndex(plan.period)!;
        for (let offset = 1; offset <= plan.total - plan.current; offset++) {
          const period = monthName(sourceIndex + offset);
          if (plans[snapshot + 1] && period >= plans[snapshot + 1].period) break;
          if (period < currentMonth || period.length !== 7) continue;
          const remaining = plan.total - plan.current - offset;
          result.push({
            ...plan,
            id: `${plan.id}:forecast:${period}`,
            source_period: plan.period,
            projected: true,
            period,
            date: `${period}-01`,
            current: plan.current + offset,
            remaining,
            remaining_amount: (Math.round(plan.amount * 100) * remaining) / 100,
            next_month: remaining ? monthName(sourceIndex + offset + 1) : "",
          });
        }
      }
    }
  }
  return result.sort(
    (a, b) =>
      a.period.localeCompare(b.period) || a.name.localeCompare(b.name) || a.id.localeCompare(b.id),
  );
}
