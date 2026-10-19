import client from "@/lib/client";
import type { Household } from "@/types";

export const householdService = {
  list: (userId: string) =>
    client.collection("household").getFullList<Household>({
      filter: client.filter("user = {:userId}", { userId }),
      sort: "name",
    }),

  create: (userId: string, name: string) =>
    client.collection("household").create<Household>({ name, user: userId }),

  update: (id: string, data: string | Partial<Household>) =>
    client
      .collection("household")
      .update<Household>(id, typeof data === "string" ? { name: data } : data),

  delete: (id: string) => client.collection("household").delete(id),
};
