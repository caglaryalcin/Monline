import { api } from "@/lib/api";
import client from "@/lib/client";
import type { YearlyCost } from "@/types";

export const yearlyCostsService = {
  list: (userId: string) =>
    client.collection("yearly_costs").getFullList<YearlyCost>({
      filter: client.filter("user = {:userId}", { userId }),
      sort: "year,month",
    }),

  snapshot: () => api.post("/api/costs/snapshot"),
};
