import type { User } from "@/types";

vi.mock("@/lib/client", () => ({
  default: {
    collection: vi.fn(),
    files: {
      getUrl: vi.fn(),
    },
  },
}));

import client from "@/lib/client";

import { usersService } from "./users";

describe("usersService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates and deletes users through Monline", async () => {
    const update = vi.fn();
    const remove = vi.fn();
    (client.collection as unknown as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce({ update })
      .mockReturnValueOnce({ delete: remove });

    await usersService.update("user-1", { name: "Daniel" });
    await usersService.delete("user-1");

    expect(client.collection).toHaveBeenNthCalledWith(1, "users");
    expect(update).toHaveBeenCalledWith("user-1", { name: "Daniel" });
    expect(remove).toHaveBeenCalledWith("user-1");
  });

  it("returns null without an avatar and delegates to client.files when present", () => {
    const withoutAvatar = { id: "user-1", name: "Daniel" } as User;
    const withAvatar = {
      id: "user-2",
      name: "Ana",
      avatar: "ana.png",
    } as User;
    (client.files.getUrl as unknown as ReturnType<typeof vi.fn>).mockReturnValue(
      "https://cdn.example.com/ana.png",
    );

    expect(usersService.avatarUrl(withoutAvatar)).toBeNull();
    expect(usersService.avatarUrl(withAvatar)).toBe("https://cdn.example.com/ana.png");
    expect(client.files.getUrl).toHaveBeenCalledWith(withAvatar, "ana.png");
  });
});
