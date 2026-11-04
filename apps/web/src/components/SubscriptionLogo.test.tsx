import { fireEvent, render, screen } from "@testing-library/react";

import { SubscriptionLogo } from "@/components/SubscriptionLogo";
import type { Subscription } from "@/types";

vi.mock("@/services/subscriptions", () => ({
  subscriptionsService: { logoUrl: () => "/api/files/subscriptions/sub/logo.png" },
}));

describe("subscription logos", () => {
  it("renders the imported SimpleLogin record with no saved logo from bundled artwork", () => {
    render(<SubscriptionLogo sub={{ id: "imported", name: "SimpleLogin", url: "", logo: "" }} />);
    expect(screen.getByRole("img", { name: "SimpleLogin" })).toHaveAttribute("src", "/assets/logos/simplelogin.svg");
    expect(screen.queryByText("S")).not.toBeInTheDocument();
  });
  it("preserves a custom uploaded SimpleLogin logo", () => {
    render(<SubscriptionLogo sub={{ id: "imported", name: "SimpleLogin", url: "", logo: "custom-simplelogin.webp" }} />);
    expect(screen.getByRole("img")).toHaveAttribute("src", "/api/files/subscriptions/sub/logo.png");
  });
  it.each(["0123456789abcdef_logo-workspace.google.com.webp", "caaf58baa3509ac9_b9219b254aed17a7_logo-google.webp", "1111111111111111_caaf58baa3509ac9_b9219b254aed17a7_logo-google.webp"])("replaces saved legacy Google icon %s and honors a custom preview", (logo) => {
    const sub = {
      id: "sub",
      name: "Google Workspace",
      url: "https://google.com",
      logo,
    };
    const { rerender } = render(<SubscriptionLogo sub={sub} />);
    expect(screen.getByRole("img")).toHaveAttribute("src", "/assets/logos/google-workspace.png");
    rerender(<SubscriptionLogo sub={sub} previewUrl="blob:custom-workspace-preview" />);
    expect(screen.getByRole("img")).toHaveAttribute("src", "blob:custom-workspace-preview");
  });
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
