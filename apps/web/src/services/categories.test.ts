vi.mock("@/lib/client", () => ({
  default: {
    collection: vi.fn(),
    filter: vi.fn(),
  },
}));

import client from "@/lib/client";

import { categoriesService } from "./categories";

function getCollectionMock(overrides: Record<string, unknown> = {}) {
  return {
    getFullList: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    ...overrides,
  };
}

describe("categoriesService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists categories sorted by name", async () => {
    const getFullList = vi.fn().mockResolvedValue([]);
    (client.filter as unknown as ReturnType<typeof vi.fn>).mockReturnValue("filter:user-1");
    (client.collection as unknown as ReturnType<typeof vi.fn>).mockReturnValue(
      getCollectionMock({ getFullList }),
    );

    await categoriesService.list("user-1");

    expect(client.collection).toHaveBeenCalledWith("categories");
    expect(client.filter).toHaveBeenCalledWith("user = {:userId}", {
      userId: "user-1",
    });
    expect(getFullList).toHaveBeenCalledWith({
      filter: "filter:user-1",
      sort: "name",
    });
  });

  it("creates, updates, and deletes categories", async () => {
    const create = vi.fn();
    const update = vi.fn();
    const remove = vi.fn();
    (client.collection as unknown as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(getCollectionMock({ create }))
      .mockReturnValueOnce(getCollectionMock({ update }))
      .mockReturnValueOnce(getCollectionMock({ delete: remove }));

    await categoriesService.create("user-1", "Streaming");
    await categoriesService.update("cat-1", "Music");
    await categoriesService.delete("cat-1");

    expect(create).toHaveBeenCalledWith({
      name: "Streaming",
      user: "user-1",
    });
    expect(update).toHaveBeenCalledWith("cat-1", { name: "Music", translation_key: "" });
    expect(remove).toHaveBeenCalledWith("cat-1");
  });
});
