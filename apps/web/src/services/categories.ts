import client from "@/lib/client";
import type { Category } from "@/types";

export const categoriesService = {
  list: (userId: string) =>
    client.collection("categories").getFullList<Category>({
      filter: client.filter("user = {:userId}", { userId }),
      sort: "name",
    }),

  create: (userId: string, name: string) =>
    client.collection("categories").create<Category>({ name, user: userId }),

  update: (id: string, name: string) =>
    client.collection("categories").update<Category>(id, { name, translation_key: "" }),

  delete: (id: string) => client.collection("categories").delete(id),
};
