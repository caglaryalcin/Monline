import client from "@/lib/client";
import type { Category } from "@/types";

export const categoriesService = {
  list: (userId: string) =>
    client.collection("categories").getFullList<Category>({
      filter: client.filter("user = {:userId}", { userId }),
      sort: "name",
    }),

  /** Counts both active and inactive subscriptions without fetching the whole list. */
  subscriptionCount: async (userId: string, categoryId: string) => {
    const result = await client.collection("subscriptions").getList(1, 1, {
      filter: client.filter("user = {:userId} && category = {:categoryId}", {
        userId,
        categoryId,
      }),
      fields: "id",
    });
    return result.totalItems;
  },

  create: (userId: string, name: string) =>
    client.collection("categories").create<Category>({ name, user: userId }),

  update: (id: string, name: string) =>
    client.collection("categories").update<Category>(id, { name, translation_key: "" }),

  delete: (id: string) => client.collection("categories").delete(id),
};
