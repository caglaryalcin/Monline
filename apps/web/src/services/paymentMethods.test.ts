import type { PaymentMethod } from "@/types";

vi.mock("@/lib/client", () => ({
  default: {
    collection: vi.fn(),
    filter: vi.fn(),
    files: {
      getUrl: vi.fn(),
    },
  },
}));

import client from "@/lib/client";

import { paymentMethodsService } from "./paymentMethods";

function getCollectionMock(overrides: Record<string, unknown> = {}) {
  return {
    getFullList: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    ...overrides,
  };
}

describe("paymentMethodsService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists payment methods for the page and for forms with distinct sorts", async () => {
    const getFullList = vi.fn().mockResolvedValue([]);
    (client.filter as unknown as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce("filter:user-1:list")
      .mockReturnValueOnce("filter:user-1:form");
    (client.collection as unknown as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(getCollectionMock({ getFullList }))
      .mockReturnValueOnce(getCollectionMock({ getFullList }));

    await paymentMethodsService.list("user-1");
    await paymentMethodsService.listForForm("user-1");

    expect(getFullList).toHaveBeenNthCalledWith(1, {
      filter: "filter:user-1:list",
      sort: "order,name",
    });
    expect(getFullList).toHaveBeenNthCalledWith(2, {
      filter: "filter:user-1:form",
      sort: "order",
    });
  });

  it("creates, updates, and deletes payment methods", async () => {
    const create = vi.fn();
    const update = vi.fn();
    const remove = vi.fn();
    const formData = new FormData();
    formData.append("name", "Credit Card");
    (client.collection as unknown as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(getCollectionMock({ create }))
      .mockReturnValueOnce(getCollectionMock({ update }))
      .mockReturnValueOnce(getCollectionMock({ delete: remove }));

    await paymentMethodsService.create(formData);
    await paymentMethodsService.update("pm-1", { name: "Pix" });
    await paymentMethodsService.delete("pm-1");

    expect(create).toHaveBeenCalledWith(formData);
    expect(update).toHaveBeenCalledWith("pm-1", { name: "Pix" });
    expect(remove).toHaveBeenCalledWith("pm-1");
  });

  it("returns null without an icon and delegates to client.files when the icon exists", () => {
    const method = { id: "pm-1", name: "Card", icon: "card.png" } as PaymentMethod;
    const withoutIcon = { id: "pm-2", name: "Cash" } as PaymentMethod;
    (client.files.getUrl as unknown as ReturnType<typeof vi.fn>).mockReturnValue(
      "https://cdn.example.com/card.png",
    );

    expect(paymentMethodsService.iconUrl(withoutIcon)).toBeNull();
    expect(paymentMethodsService.iconUrl(method)).toBe("https://cdn.example.com/card.png");
    expect(client.files.getUrl).toHaveBeenCalledWith(method, "card.png");
  });
});
