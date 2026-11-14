import { api } from "@/lib/api";

export const loansService = {
  savePaymentDay: (rowId: string, day: number, fromYear: number) =>
    api.put<{ payment_day: number; updated: number }>(
      `/api/loans/${encodeURIComponent(rowId)}/payment-day`,
      { day, from_year: fromYear },
    ),
  savePrincipal: (rowId: string, amount: number | null) =>
    api.put<{ principal_amount: number | null }>(
      `/api/loans/${encodeURIComponent(rowId)}/principal`,
      { amount },
    ),
};
