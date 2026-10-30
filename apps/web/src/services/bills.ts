import { api } from "@/lib/api";

export interface ManualBillInput {
  name: string;
  date: string;
  amount: number;
  currency: string;
  status: "planned" | "settled";
  notes: string;
}
export const billsService = {
  save: (body: ManualBillInput, id?: string) =>
    id ? api.put(`/api/bills/${id}`, body) : api.post("/api/bills", body),
  remove: (id: string) => api.del(`/api/bills/${id}`),
};
