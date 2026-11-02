import client from "@/lib/client";
import type { PaymentAccount } from "@/types";

export const paymentAccountsService = {
  list: (userId: string) =>
    client.collection("payment_accounts").getFullList<PaymentAccount>({
      filter: client.filter("user = {:userId}", { userId }),
      sort: "name,id",
    }),
  create: (user: string, name: string) =>
    client.collection("payment_accounts").create<PaymentAccount>({ user, name }),
  update: (id: string, name: string) =>
    client.collection("payment_accounts").update<PaymentAccount>(id, { name }),
  delete: (id: string) => client.collection("payment_accounts").delete(id),
};
