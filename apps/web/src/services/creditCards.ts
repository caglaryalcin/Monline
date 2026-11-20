import { api } from "@/lib/api";
import client from "@/lib/client";
import type { CardStatement, CreditCard, CreditCardInput, CreditCardsData } from "@/lib/creditCards";
import type { SavedStatement } from "@/lib/statements";

import { savedStatementCard, type StatementCardDetails } from "../../../backend/src/domain/lib/pure/statement-card.mjs";

export const creditCardsService = {
  list: () => api.get<CreditCardsData>("/api/credit-cards"),
  create: (value: CreditCardInput, statement_ids: string[]) => api.post<CreditCard>("/api/credit-cards", { ...value, statement_ids }),
  update: (id: string, value: CreditCardInput) => api.put<CreditCard>(`/api/credit-cards/${id}`, value),
  remove: (id: string) => api.del(`/api/credit-cards/${id}`),
  assign: (id: string, statement_ids: string[]) => api.post(`/api/credit-cards/${id}/statements`, { statement_ids }),
  sourceDetails: async (id: string) => savedStatementCard(await client.collection("bank_statements").getOne<SavedStatement>(id)),
  saveDetails: (id: string, file_hash: string, card_details: StatementCardDetails) =>
    api.put<StatementCardDetails>(`/api/statements/${id}/card-details`, { file_hash, card_details }),
  unassigned: () => client.collection("bank_statements").getFullList<CardStatement>({
    filter: 'credit_card = ""', sort: "-period,-created", fields: "id,bank,period,file_name,file_hash,credit_card,card_details",
  }),
};
