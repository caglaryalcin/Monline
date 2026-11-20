import { type CreditCard,supportedCardBank } from "@/lib/creditCards";

export interface CreditCardClosing {
  kind: "closing" | "payment_due";
  card: CreditCard;
  date: string;
  original_date: string;
  cycle_month: string;
}
function dateString(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function creditCardClosing(card: CreditCard, year: number, month: number): CreditCardClosing | null {
  const day = card.statement_day || 0;
  if (!Number.isInteger(day) || day < 1 || day > 31) return null;
  const lastDay = new Date(year, month, 0, 12).getDate();
  const date = new Date(year, month - 1, Math.min(day, lastDay), 12);
  const original = dateString(date);
  if (card.statement_weekend_adjust) {
    if (date.getDay() === 6) date.setDate(date.getDate() + 2);
    else if (date.getDay() === 0) date.setDate(date.getDate() + 1);
  }
  return { kind: "closing", card, date: dateString(date), original_date: original, cycle_month: `${year}-${String(month).padStart(2, "0")}` };
}
/** Include prior cycles so a month-end weekend shift also appears next month. */
export function creditCardClosings(cards: CreditCard[], year: number, month: number, adjacent = false) {
  const from = dateString(new Date(year, month - 1, adjacent ? -5 : 1, 12));
  const to = dateString(new Date(year, month, adjacent ? 6 : 0, 12));
  return [-2, -1, 0, 1].flatMap(offset => {
    const cycle = new Date(year, month - 1 + offset, 1, 12);
    return cards.flatMap(card => {
      const event = creditCardClosing(card, cycle.getFullYear(), cycle.getMonth() + 1);
      if (!event) return [];
      const events = [event];
      if (supportedCardBank(card.bank) === "enpara") {
        const due = new Date(`${event.date}T12:00:00`);
        due.setDate(due.getDate() + 10);
        const date = dateString(due);
        events.push({ ...event, kind: "payment_due", date, original_date: date });
      }
      return events.filter(item => item.date >= from && item.date <= to);
    });
  }).sort((a, b) => a.date.localeCompare(b.date) || a.card.id.localeCompare(b.card.id));
}
