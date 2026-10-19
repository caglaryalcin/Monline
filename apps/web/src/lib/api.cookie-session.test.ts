import { api } from "./api";

vi.mock("./client", () => ({ default: { authStore: { token: "" } } }));

it("allows cookie restoration without sending an empty Bearer authorization header", async () => {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ token: "cookie-session" }), {
      headers: { "Content-Type": "application/json" },
    }),
  );
  vi.stubGlobal("fetch", fetchMock);
  try {
    await api.post("/api/auth/refresh");
    const headers = fetchMock.mock.calls[0][1].headers as Headers;
    expect(headers.has("Authorization")).toBe(false);
  } finally {
    vi.unstubAllGlobals();
  }
});
