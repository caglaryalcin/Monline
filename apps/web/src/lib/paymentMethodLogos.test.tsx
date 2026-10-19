import { fireEvent, render, screen } from "@testing-library/react";

import { PaymentMethodLogo } from "@/components/PaymentMethodLogo";
import type { PaymentMethod } from "@/types";

import { paymentMethodLogoSources } from "./paymentMethodLogos";

vi.mock("@/services/paymentMethods", () => ({
  paymentMethodsService: {
    iconUrl: (method: PaymentMethod) => (method.icon ? `/uploaded/${method.icon}` : null),
  },
}));
const method = (name: string, icon = ""): PaymentMethod => ({
  id: "pm-1",
  user: "user-1",
  name,
  icon,
});

it.each([
  ["İŞ BANKASI Kredi Kartım", "isbank.com.tr"],
  ["isbankasi", "isbank.com.tr"],
  ["Yapı Kredi World", "yapikredi.com.tr"],
  ["AKBANK Axess", "akbank.com"],
  ["QNB Finansbank", "qnb.com.tr"],
  ["Vakıf Katılım", "vakifkatilim.com.tr"],
  ["Ziraat Katılım", "ziraatkatilim.com.tr"],
  ["Ziraat Bankası", "ziraatbank.com.tr"],
  ["Şekerbank", "sekerbank.com.tr"],
  ["KuveytTürk", "kuveytturk.com.tr"],
  ["Garanti BBVA Bonus", "garantibbva.com.tr"],
])("recognizes %s without confusing Turkish characters or card suffixes", (name, domain) => {
  expect(paymentMethodLogoSources(method(name))).toContain(`https://icon.horse/icon/${domain}`);
});
it("prefers bundled bank assets, then two remote sources", () => {
  expect(paymentMethodLogoSources(method("Enpara kartım"))).toEqual([
    "/assets/logos/banks/enpara.svg",
    "https://icon.horse/icon/enpara.com",
    "https://icons.duckduckgo.com/ip3/enpara.com.ico",
  ]);
});
it("keeps uploaded icons and payment network logos, and never guesses arbitrary names", () => {
  expect(paymentMethodLogoSources(method("Akbank", "my-card.png"))).toEqual([
    "/uploaded/my-card.png",
  ]);
  expect(paymentMethodLogoSources(method("Visa"))).toEqual(["/assets/payments/Visa.png"]);
  expect(paymentMethodLogoSources(method("Billing card"))).toEqual([]);
  expect(paymentMethodLogoSources(method("Private bank account"))).toEqual([]);
});
it("tries the next logo when loading fails and resets when the bank changes", () => {
  const { rerender } = render(<PaymentMethodLogo method={method("Enpara")} size={48} />);
  fireEvent.error(screen.getByRole("img"));
  expect(screen.getByRole("img")).toHaveAttribute("src", "https://icon.horse/icon/enpara.com");
  fireEvent.error(screen.getByRole("img"));
  expect(screen.getByRole("img")).toHaveAttribute(
    "src",
    "https://icons.duckduckgo.com/ip3/enpara.com.ico",
  );
  fireEvent.error(screen.getByRole("img"));
  expect(screen.queryByRole("img")).not.toBeInTheDocument();
  expect(screen.getByText("E")).toBeInTheDocument();
  rerender(<PaymentMethodLogo method={method("Akbank")} size={48} />);
  expect(screen.getByRole("img")).toHaveAttribute("src", "/assets/logos/banks/akbank.svg");
});
