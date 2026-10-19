import client from "@/lib/client";
import type { Cycle } from "@/types";

export const cyclesService = {
  /** Global list — cycles are not user-scoped. */
  list: () => client.collection("cycles").getFullList<Cycle>(),
};
