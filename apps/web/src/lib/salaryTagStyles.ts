import type { SalaryTag } from "@/lib/finance";

export const SALARY_TAG_STYLES: Record<SalaryTag, { text: string; background: string }> = {
  job_change: { text: "text-sky-700 dark:text-sky-300", background: "bg-sky-500/10" },
  raise: { text: "text-emerald-700 dark:text-emerald-300", background: "bg-emerald-500/10" },
  seniority_raise: { text: "text-amber-700 dark:text-amber-300", background: "bg-amber-500/10" },
  seniority_inflation_raise: { text: "text-violet-700 dark:text-violet-300", background: "bg-violet-500/10" },
};
