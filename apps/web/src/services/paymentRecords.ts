import client from "@/lib/client";
import type { PaymentRecord } from "@/types";

export interface HistoricalPaymentInput {
  subscription_id: string;
  due_date: string;
  paid_date: string;
  amount: number;
  notes?: string;
  utc_offset_minutes: number;
  paid_utc_offset_minutes: number;
}

export const paymentRecordsService = {
  createHistorical: (data: HistoricalPaymentInput) =>
    client.send<PaymentRecord>("/api/payments/history", { method: "POST", body: data }),

  listForUser: (userId: string) =>
    client.collection("payment_records").getFullList<PaymentRecord>({
      filter: client.filter("user = {:userId}", { userId }),
    }),

  listForSubscription: (subscriptionId: string, userId: string) =>
    client.collection("payment_records").getFullList<PaymentRecord>({
      filter: client.filter("subscription_id = {:subscriptionId} && user = {:userId}", {
        subscriptionId,
        userId,
      }),
    }),

  create: (data: FormData | Partial<PaymentRecord>) =>
    client.collection("payment_records").create<PaymentRecord>(data),

  update: (id: string, data: FormData | Partial<PaymentRecord>) =>
    client.collection("payment_records").update<PaymentRecord>(id, data),

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
