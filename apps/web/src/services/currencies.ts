import client from "@/lib/client";
import type { Currency } from "@/types";

export const currenciesService = {
  list: (userId: string) =>
    client.collection("currencies").getFullList<Currency>({
      filter: client.filter("user = {:userId}", { userId }),
      sort: "-is_main,name",
    }),

  listMain: (userId: string) =>
    client.collection("currencies").getFullList<Currency>({
      filter: client.filter("user = {:userId} && is_main = true", { userId }),
    }),

  create: (userId: string, data: Partial<Currency>) =>
    client
      .collection("currencies")
      .create<Currency>({ ...data, user: userId, rate: data.rate ?? 1 }),

  update: (id: string, data: Partial<Currency>) =>
    client.collection("currencies").update<Currency>(id, data),

  delete: (id: string) => client.collection("currencies").delete(id),
};
