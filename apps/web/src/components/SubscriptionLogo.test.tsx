import { fireEvent, render, screen } from "@testing-library/react";

import type { Subscription } from "@/types";

import { SubscriptionLogo } from "./SubscriptionLogo";

vi.mock("@/services/subscriptions", () => ({
  subscriptionsService: { logoUrl: () => "/api/files/subscriptions/sub/logo.png" },
}));

describe("subscription logos", () => {
  it("shows the Workspace logo in previews without overriding a custom uploaded logo", () => {
    const { rerender } = render(<SubscriptionLogo sub={{ name: "Google Workspace", url: "" }} />);
    expect(screen.getByRole("img")).toHaveAttribute("src", "/assets/logos/google-workspace.png");
    rerender(
      <SubscriptionLogo
        sub={{ id: "sub", logo: "custom-logo.png", name: "Google Workspace", url: "" }}
      />,
    );
    expect(screen.getByRole("img")).toHaveAttribute("src", "/api/files/subscriptions/sub/logo.png");
  });
  const sub = {
    id: "sub",
    name: "Spotify",
    url: "https://spotify.com/account",
    logo: "logo.png",
  } as Subscription;

  it("prefers the uploaded image and falls back through site icons to an initial", () => {
    render(<SubscriptionLogo sub={sub} />);
    expect(screen.getByRole("img", { name: "Spotify" })).toHaveAttribute(
      "src",
      "/api/files/subscriptions/sub/logo.png",
    );
    fireEvent.error(screen.getByRole("img"));
    expect(screen.getByRole("img")).toHaveAttribute("src", "https://icon.horse/icon/spotify.com");
    fireEvent.error(screen.getByRole("img"));
    expect(screen.getByRole("img")).toHaveAttribute(
      "src",
      "https://icons.duckduckgo.com/ip3/spotify.com.ico",
    );
    fireEvent.error(screen.getByRole("img"));
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByText("S")).toBeInTheDocument();
  });

  it("shows a known service icon without an uploaded image and resets when the subscription changes", () => {
    const { rerender } = render(
      <SubscriptionLogo sub={{ ...sub, logo: "", url: "", name: "Chatgpt" }} />,
    );
    expect(screen.getByRole("img")).toHaveAttribute("src", "https://icon.horse/icon/openai.com");
    fireEvent.error(screen.getByRole("img"));
    rerender(<SubscriptionLogo sub={sub} />);
    expect(screen.getByRole("img")).toHaveAttribute("src", "/api/files/subscriptions/sub/logo.png");
  });
});
