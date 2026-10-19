/** Keep the statement charge's day, anchored to next month in the user's calendar. */
export function nextStatementPaymentDate(date: string, now = new Date()): string {
  const day = Number(date.slice(8, 10));
  if (!day || !Number.isFinite(now.getTime())) return "";
  const target = new Date(now.getFullYear(), now.getMonth() + 1, 1, 12);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(day, lastDay));
  return `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, "0")}-${String(target.getDate()).padStart(2, "0")}`;
}
