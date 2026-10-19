import client from "@/lib/client";
import type { PaymentMethod } from "@/types";

export const paymentMethodsService = {
  list: (userId: string) =>
    client.collection("payment_methods").getFullList<PaymentMethod>({
      filter: client.filter("user = {:userId}", { userId }),
      sort: "order,name",
    }),

  /** Returns a sorted list for use in forms (sort by order). */
  listForForm: (userId: string) =>
    client.collection("payment_methods").getFullList<PaymentMethod>({
      filter: client.filter("user = {:userId}", { userId }),
      sort: "order",
    }),

  create: (data: FormData) => client.collection("payment_methods").create<PaymentMethod>(data),

  update: (id: string, data: FormData | Partial<PaymentMethod>) =>
    client.collection("payment_methods").update<PaymentMethod>(id, data),

  delete: (id: string) => client.collection("payment_methods").delete(id),

  iconUrl: (record: PaymentMethod) =>
    record.icon ? client.files.getUrl(record, record.icon) : null,
};
