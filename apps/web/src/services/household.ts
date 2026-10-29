import { api } from "@/lib/api";
import client from "@/lib/client";
import type { Household } from "@/types";

export const householdService = {
  list: async (userId: string) => {
    const people = await client.collection("household").getFullList<Household>({
      filter: client.filter("user = {:userId}", { userId }),
      sort: "name",
    });
    return people.sort((a, b) => Number(b.account_id === userId) - Number(a.account_id === userId));
  },

  create: (userId: string, name: string, accountEmail: string) =>
    client.collection("household").create<Household>({
      name,
      user: userId,
      account_email: accountEmail,
    }),

  update: (id: string, data: string | Partial<Household>) =>
    client
      .collection("household")
      .update<Household>(id, typeof data === "string" ? { name: data } : data),

  delete: (id: string) => client.collection("household").delete(id),
  resendInvitation: (id: string) =>
    api.post<{ invitation_status: Household["invitation_status"] }>(`/api/people/${id}/resend`),
};
