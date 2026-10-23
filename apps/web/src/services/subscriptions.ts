import { api } from "@/lib/api";
import client from "@/lib/client";
import type { Subscription } from "@/types";

const FULL_EXPAND = "currency,cycle,category,payment_method,payer";

export const subscriptionsService = {
  deleteAll: () =>
    api.post<{ deleted: number }>("/api/subscriptions/delete-all", { confirmed: true }),
  /** All subscriptions for a user (active + inactive), with full relations. */
  list: (userId: string) =>
    client.collection("subscriptions").getFullList<Subscription>({
      filter: client.filter("user = {:userId}", { userId }),
      expand: FULL_EXPAND,
    }),

  /** Only active subscriptions — used by dashboard summary. */
  listActive: (userId: string) =>
    client.collection("subscriptions").getFullList<Subscription>({
      filter: client.filter("user = {:userId} && inactive = false", { userId }),
      expand: "currency,cycle",
    }),

  /** Only active subscriptions with full expand — used by statistics. */
  listActiveExpanded: (userId: string) =>
    client.collection("subscriptions").getFullList<Subscription>({
      filter: client.filter("user = {:userId} && inactive = false", { userId }),
      expand: FULL_EXPAND,
    }),

  create: (data: FormData | Partial<Subscription>) =>
    client.collection("subscriptions").create<Subscription>(data),

  update: (id: string, data: FormData | Partial<Subscription>) =>
    client.collection("subscriptions").update<Subscription>(id, data),

  delete: (id: string) => client.collection("subscriptions").delete(id),

  clone: (id: string) => api.post<{ id: string }>("/api/subscription/clone", { id }),

  renew: (id: string) => api.post<{ id: string }>("/api/subscription/renew", { id }),

  export: () => api.get<{ subscriptions: unknown[] }>("/api/subscriptions/export"),

  import: (subscriptions: unknown[]) =>
    api.post<{
      imported: number;
      skipped: number;
      errors: { index: number; name?: string; reason?: string; warning?: string }[];
    }>("/api/subscriptions/import", { subscriptions }),

  logoUrl: (
    sub: Pick<Subscription, "id" | "logo"> & Pick<Partial<Subscription>, "standalone_payment_id">,
  ): string | null => {
    if (!sub.logo) return null;
    return client.files.getUrl(
      {
        collectionId: sub.standalone_payment_id ? "payment_records" : "subscriptions",
        id: sub.id,
      } as Parameters<typeof client.files.getUrl>[0],
      sub.logo,
    );
  },
};
