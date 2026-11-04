import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";

import { ProfileLocationFields } from "@/components/settings/profile/ProfileLocationFields";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { resolvedLanguage: "en" } }),
}));

function Harness({ initialCountry = "", initialRegion = "" }: { initialCountry?: string; initialRegion?: string }) {
  const [country, setCountry] = useState(initialCountry);
  const [region, setRegion] = useState(initialRegion);
  return <><ProfileLocationFields country={country} region={region} onCountryChange={setCountry} onRegionChange={setRegion} />
    <output aria-label="selection">{country}/{region}</output></>;
}

beforeAll(() => {
  vi.stubGlobal("PointerEvent", MouseEvent);
  HTMLElement.prototype.scrollIntoView = vi.fn();
  HTMLElement.prototype.hasPointerCapture = vi.fn(() => false);
  HTMLElement.prototype.setPointerCapture = vi.fn();
  HTMLElement.prototype.releasePointerCapture = vi.fn();
});
afterEach(cleanup);

it("starts with no country and a disabled region selector", () => {
  render(<Harness />);
  expect(screen.getByRole("combobox", { name: "holiday_country" })).toHaveTextContent("holiday_country_none");
  expect(screen.getByRole("combobox", { name: "holiday_region" })).toBeDisabled();
});

it("shows saved country and region preferences", () => {
  render(<Harness initialCountry="DE" initialRegion="BB" />);
  expect(screen.getByRole("combobox", { name: "holiday_country" })).toHaveTextContent("Germany");
  expect(screen.getByRole("combobox", { name: "holiday_region" })).toHaveTextContent("Brandenburg");
});

it("clears a previous region when switching to a country without regional calendars", async () => {
  const user = userEvent.setup();
  render(<Harness initialCountry="DE" initialRegion="BB" />);
  await user.click(screen.getByRole("combobox", { name: "holiday_country" }));
  await user.click(screen.getByRole("option", { name: /Türkiye|Turkey/ }));
  expect(screen.getByLabelText("selection")).toHaveTextContent("TR/");
  expect(screen.getByRole("combobox", { name: "holiday_region" })).toBeDisabled();
  expect(screen.getByRole("combobox", { name: "holiday_region" })).toHaveTextContent("holiday_region_nationwide");
});
