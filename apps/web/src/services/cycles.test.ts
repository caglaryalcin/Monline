vi.mock("@/lib/client", () => ({
  default: {
    collection: vi.fn(),
  },
}));

import client from "@/lib/client";

import { cyclesService } from "./cycles";

describe("cyclesService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists global cycles through Monline", async () => {
    const getFullList = vi.fn().mockResolvedValue([]);
    (client.collection as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      getFullList,
    });

    await cyclesService.list();

    expect(client.collection).toHaveBeenCalledWith("cycles");
    expect(getFullList).toHaveBeenCalledWith();
  });
});
