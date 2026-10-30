import client from "@/lib/client";
import type { PaymentRecord } from "@/types";

function paymentBody(data: FormData | Partial<PaymentRecord>) {
  if (data instanceof FormData || !Object.values(data).some((value) => value instanceof Blob))
    return data;
  const form = new FormData();
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) continue;
    form.set(
      key,
      value instanceof Blob
        ? value
        : typeof value === "object"
          ? JSON.stringify(value)
          : String(value),
    );
  }
  return form;
}

export interface HistoricalPaymentInput {
  subscription_id?: string;
  name?: string;
  currency?: string;
  category?: string;
  payment_method?: string;
  payer?: string;
  due_date: string;
  paid_date: string;
  amount: number;
  notes?: string;
  utc_offset_minutes: number;
  paid_utc_offset_minutes: number;
}

export const paymentRecordsService = {
  move: (data: {
    payment_id?: string;
    subscription_id?: string;
    source?: string;
    source_id?: string;
    from_date: string;
    to_date: string;
    mode?: "ledger";
    expected_source_date?: string;
    expected_amount?: number;
  }) =>
    client.send<{ updated: number; payment?: PaymentRecord; ledger_updated?: boolean }>(
      "/api/calendar/move-payment",
      {
        method: "POST",
        body: data,
      },
    ),
  markUnpaid: (id: string) =>
    client.send<{ updated: number }>(`/api/payments/${encodeURIComponent(id)}/mark-unpaid`, {
      method: "POST",
    }),

  createHistorical: (data: HistoricalPaymentInput | FormData) =>
    client.send<PaymentRecord>("/api/payments/history", { method: "POST", body: data }),

  listForUser: (userId: string) =>
    client.collection("payment_records").getFullList<PaymentRecord>({
      filter: client.filter("user = {:userId}", { userId }),
      expand: "currency,category,payment_method,payer",
    }),

  listForSubscription: (subscriptionId: string, userId: string) =>
    client.collection("payment_records").getFullList<PaymentRecord>({
      filter: client.filter("subscription_id = {:subscriptionId} && user = {:userId}", {
        subscriptionId,
        userId,
      }),
    }),

  create: (data: FormData | Partial<PaymentRecord>) =>
    client.collection("payment_records").create<PaymentRecord>(paymentBody(data)),

  update: (id: string, data: FormData | Partial<PaymentRecord>) =>
    client.collection("payment_records").update<PaymentRecord>(id, paymentBody(data)),

  remove: (id: string) => client.collection("payment_records").delete(id),

  clearCalendar: (scope: "payments") =>
    client.send<{ subscriptions_deleted: number; payments_deleted: number }>(
      "/api/calendar/clear",
      {
        method: "POST",
        body: { confirmed: true, scope },
      },
    ),

  proofUrl: (record: PaymentRecord) =>
    record.proof
      ? client.files.getUrl(
          { collectionId: "payment_records", id: record.id } as Parameters<
            typeof client.files.getUrl
          >[0],
          record.proof,
        )
      : null,
};
