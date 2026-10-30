import type { useFinanceGrid } from "@/hooks/useFinanceGrid";
import { financeService } from "@/services/finance";

type QuickGridState = Pick<
  ReturnType<typeof useFinanceGrid>,
  "quickEdit" | "quickName" | "finishQuickEdit" | "finishQuickName"
>;
interface QuickSaveContext {
  year: number;
  today: string;
  run: (action: () => Promise<unknown>, close?: boolean) => Promise<boolean>;
}

/** Keep quick edits in their original budget month and close them only after a successful save. */
export function createFinanceQuickSavers(
  grid: QuickGridState,
  { year, today, run }: QuickSaveContext,
) {
  const saveQuickAmounts = async (amounts: (number | null)[], focus: boolean) => {
    const edit = grid.quickEdit;
    if (!edit) return false;
    if (
      edit.entries.length &&
      edit.entries.every((entry, index) => entry.amount === amounts[index])
    ) {
      grid.finishQuickEdit(focus);
      return true;
    }
    const month = `${edit.year}-${String(edit.month).padStart(2, "0")}`;
    const status =
      edit.row.kind !== "expense" && month <= today.slice(0, 7) ? "settled" : "planned";
    const saved = await run(
      () =>
        edit.entries.length
          ? financeService.restore({
              before: edit.entries.flatMap((entry, index) => {
                const amount = amounts[index];
                return amount === null
                  ? []
                  : [
                      {
                        ...entry,
                        amount,
                        source_payment: entry.source_payment || "",
                      },
                    ];
              }),
              after: edit.entries.map((entry) => ({
                ...entry,
                source_payment: entry.source_payment || "",
              })),
            })
          : financeService.save("finance_entries", {
              row_id: edit.row.id,
              date: `${month}-01`,
              amount: amounts[0],
              status,
              settled_date: status === "settled" ? today : "",
              notes: "",
            }),
      false,
    );
    if (saved) grid.finishQuickEdit(focus);
    return saved;
  };
  const saveQuickName = async (name: string, focus: boolean) => {
    const row = grid.quickName;
    if (!row) return false;
    if (name === row.name) {
      grid.finishQuickName(focus);
      return true;
    }
    const saved = await run(
      () => financeService.save("finance_rows", { name }, row.id, year),
      false,
    );
    if (saved) grid.finishQuickName(focus);
    return saved;
  };

  return { saveQuickAmounts, saveQuickName };
}
