import { api } from "@/lib/api";

export const loansService = {
  savePrincipal: (rowId: string, amount: number | null) =>
    api.put<{ principal_amount: number | null }>(
      `/api/loans/${encodeURIComponent(rowId)}/principal`,
      { amount },
    ),
};
