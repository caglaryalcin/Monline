import client from "@/lib/client";
import type { User } from "@/types";

export const usersService = {
  update: (id: string, data: FormData | Partial<User>) =>
    client.collection("users").update<User>(id, data),

  delete: (id: string) => client.collection("users").delete(id),

  avatarUrl: (user: User) => (user.avatar ? client.files.getUrl(user, user.avatar) : null),
};
