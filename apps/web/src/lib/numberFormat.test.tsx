import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CurrencyInput } from "@/components/ui/currency-input";
import client from "@/lib/client";
import i18n from "@/lib/i18n";
import { formatNumber, parseNumberInput, resolveNumberLocale, setNumberLocale } from "@/lib/numberFormat";
import { formatPrice } from "@/lib/utils";
import type { User } from "@/types";

beforeEach(async () => {
  client.authStore.clear();
  vi.spyOn(navigator, "languages", "get").mockReturnValue(["nl-NL"]);
  vi.spyOn(navigator, "language", "get").mockReturnValue("nl-NL");
  await i18n.changeLanguage("en");
});
afterEach(() => { cleanup(); client.authStore.clear(); vi.restoreAllMocks(); });

function control(value: number, code = "EUR") {
  const changed = vi.fn();
  function Controlled() {
    const [amount, setAmount] = useState(value);
    return <CurrencyInput value={amount} code={code} onChange={next => { changed(next); setAmount(next); }} />;
  }
  render(<Controlled />);
  return { input: screen.getByRole("textbox"), changed };
}

it("uses the browser's regional separators in both subscription inputs and displayed prices with an English interface", () => {
  const { input } = control(78.34);
  expect(resolveNumberLocale()).toBe("nl-NL");
  expect(input).toHaveValue("78,34");
  expect(formatPrice(78.34, "€", { currencyCode: "EUR" })).toContain("78,34");
  expect(i18n.resolvedLanguage).toBe("en");
});

it("does not change the number format when only the interface language changes", async () => {
  expect(formatPrice(1234.56, "€")).toContain("1.234,56");
  await i18n.changeLanguage("tr");
  expect(formatPrice(1234.56, "€")).toContain("1.234,56");
});

it("lets the account override the browser and updates existing inputs immediately", () => {
  const { input } = control(1234.56);
  act(() => setNumberLocale("en-US"));
  expect(input).toHaveValue("1,234.56");
  expect(formatPrice(1234.56, "€")).toContain("1,234.56");
  act(() => setNumberLocale(""));
  expect(input).toHaveValue("1.234,56");
});

it("isolates account preferences and returns to the browser format on logout", () => {
  client.authStore.save("first", { id: "first", number_locale: "en-US" } as User);
  expect(formatPrice(78.34, "€")).toContain("78.34");
  client.authStore.save("second", { id: "second", number_locale: "de-DE" } as User);
  expect(formatPrice(78.34, "€")).toContain("78,34");
  client.authStore.clear();
  expect(resolveNumberLocale()).toBe("nl-NL");
});

it("adopts persisted account preferences from a remembered session update in another tab", () => {
  client.authStore.save("first", { id: "first", number_locale: "en-US" } as User, true);
  window.dispatchEvent(new StorageEvent("storage", { key: "monline_session", storageArea: localStorage,
    newValue: JSON.stringify({ token: "first", record: { id: "first", number_locale: "fr-FR" }, remember: true }) }));
  expect(resolveNumberLocale()).toBe("fr-FR");
  expect(formatPrice(1234.56, "€")).toContain(new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2 }).format(1234.56));
});

it("uses the next supported browser language and falls back safely for invalid settings", () => {
  vi.spyOn(navigator, "languages", "get").mockReturnValue(["xx-YY", "de-CH"]);
  expect(resolveNumberLocale("invalid_locale_!" )).toBe("de-CH");
  vi.spyOn(navigator, "languages", "get").mockReturnValue([]);
  vi.spyOn(navigator, "language", "get").mockReturnValue("invalid_!");
  expect(resolveNumberLocale()).toBe("en-US");
});

describe("localized amount parsing", () => {
  it.each([
    ["de-DE", "78,34", 78.34], ["de-DE", "78.34", 78.34],
    ["de-DE", "1.234,56", 1234.56], ["en-US", "1,234.56", 1234.56],
    ["de-DE", "1.234.567", 1234567], ["en-US", "1,234,567", 1234567],
    ["de-DE", "1.234", 1234], ["en-US", "1,234", 1234],
    ["de-DE", "1,234", 1.234], ["en-US", "1.234", 1.234],
    ["fr-FR", "1\u202f234,56", 1234.56], ["de-CH", "1’234.56", 1234.56],
    ["hi-IN", "12,34,567.89", 1234567.89], ["ar-EG", "١٬٢٣٤٫٥٦", 1234.56],
  ])("parses %s amount %s without changing its value", (locale, text, expected) => {
    expect(parseNumberInput(text as string, locale as string)).toBe(expected);
  });

  it.each(["en-US", "de-DE", "fr-FR", "de-CH", "hi-IN", "ar-EG"])("round-trips displayed positive and negative values in %s", locale => {
    for (const value of [0, 78.34, 1234.56, 1234567.89, -1234.56]) {
      const text = formatNumber(value, { minimumFractionDigits: 2, maximumFractionDigits: 2 }, locale);
      expect(parseNumberInput(text, locale)).toBe(value);
    }
  });
});

it("keeps a saved three-decimal amount unchanged after focus and blur", () => {
  act(() => setNumberLocale("de-DE"));
  const { input, changed } = control(1.234, "BHD");
  expect(input).toHaveValue("1,234");
  fireEvent.focus(input);
  expect(input).toHaveValue("1,234");
  fireEvent.blur(input);
  expect(changed).toHaveBeenLastCalledWith(1.234);
});

it.each(["1.234,56", "1,234.56", "1\u202f234,56"])("saves a pasted localized amount %s as a number", text => {
  const { input, changed } = control(10);
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value: text } });
  fireEvent.blur(input);
  expect(changed).toHaveBeenLastCalledWith(1234.56);
  expect(input).toHaveValue("1.234,56");
});

it("preserves the value if the account format changes while an amount is being edited", () => {
  act(() => setNumberLocale("de-DE"));
  const { input, changed } = control(1.234, "BHD");
  fireEvent.focus(input);
  act(() => setNumberLocale("en-US"));
  fireEvent.blur(input);
  expect(changed).toHaveBeenLastCalledWith(1.234);
  expect(input).toHaveValue("1.234");
});

it("preserves currency-specific decimal precision and uses localized placeholders", () => {
  const { input } = control(1234, "JPY");
  expect(input).toHaveValue("1.234");
  expect(formatPrice(1234, "¥", { currencyCode: "JPY" })).toContain("1.234");
  cleanup();
  render(<CurrencyInput value={0} code="EUR" onChange={() => {}} />);
  expect(screen.getByRole("textbox")).toHaveAttribute("placeholder", "0,00");
});
