import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createInstance } from "i18next";
import { useState } from "react";
import { I18nextProvider } from "react-i18next";
import { describe, expect, it, vi } from "vitest";

import { DatePicker } from "./date-picker";

beforeAll(() => {
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
  Element.prototype.scrollIntoView = () => {};
});

async function renderPicker(language = "tr", value = "2026-06-01", openCalendar = true) {
  const i18n = createInstance();
  await i18n.init({
    lng: language,
    fallbackLng: "en",
    resources: {
      tr: { translation: { today: "Bugün" } },
      en: { translation: { today: "Today" } },
      de: { translation: { today: "Heute" } },
    },
  });
  const onChange = vi.fn();
  function Example() {
    const [date, setDate] = useState(value);
    return (
      <DatePicker
        name="start_date"
        label="Başlangıç tarihi"
        value={date}
        onChange={(next) => {
          setDate(next);
          onChange(next);
        }}
      />
    );
  }
  render(
    <I18nextProvider i18n={i18n}>
      <Example />
    </I18nextProvider>,
  );
  const user = userEvent.setup();
  if (openCalendar) await user.click(screen.getByRole("button", { name: /^Başlangıç tarihi:/ }));
  return { user, i18n, onChange };
}

describe("localized date picker", () => {
  it.each(["03/11/2026", "03.11.2026", "03112026", "2026-11-03"])(
    "accepts a manually entered date (%s) and opens the calendar at that date",
    async (typed) => {
      const { user, onChange } = await renderPicker("tr", "2026-06-01", false);
      const input = screen.getByRole("textbox", { name: "Başlangıç tarihi" });
      await user.clear(input);
      await user.type(input, typed);
      expect(input).toHaveValue("03/11/2026");
      expect(onChange).toHaveBeenLastCalledWith("2026-11-03");
      expect(document.querySelector('input[name="start_date"]')).toHaveValue("2026-11-03");
      await user.click(screen.getByRole("button", { name: /^Başlangıç tarihi:/ }));
      expect(screen.getByRole("combobox", { name: "Ayı seçin" })).toHaveTextContent("Kasım");
    },
  );
  it.each(["31/02/2026", "29/02/2025", "03/11/20"])(
    "marks invalid or unfinished input (%s)",
    async (typed) => {
      const { user } = await renderPicker("tr", "2026-06-01", false);
      const input = screen.getByRole("textbox", { name: "Başlangıç tarihi" });
      await user.clear(input);
      await user.type(input, typed);
      expect(input).toHaveValue(typed);
      expect(input).toHaveAttribute("aria-invalid", "true");
      expect(screen.getByRole("alert")).toBeInTheDocument();
    },
  );
  it("synchronizes the text input when the parent changes the date", async () => {
    const onChange = vi.fn();
    const { rerender } = render(<DatePicker label="Date" value="2026-06-01" onChange={onChange} />);
    rerender(<DatePicker label="Date" value="2027-01-05" onChange={onChange} />);
    expect(screen.getByRole("textbox", { name: "Date" })).toHaveValue("05/01/2027");
    expect(onChange).not.toHaveBeenCalled();
  });
  it("disables dates outside the supplied range while allowing both boundary dates", async () => {
    const onChange = vi.fn();
    render(
      <DatePicker
        label="Bounded date"
        value="2026-06-10"
        min="2026-06-05"
        max="2026-06-15"
        onChange={onChange}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: /^Bounded date:/ }));
    expect(screen.getByRole("button", { name: /^Thursday, June 4th, 2026/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /^Friday, June 5th, 2026/ })).toBeEnabled();
    expect(screen.getByRole("button", { name: /^Monday, June 15th, 2026/ })).toBeEnabled();
    expect(screen.getByRole("button", { name: /^Tuesday, June 16th, 2026/ })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: /^Monday, June 15th, 2026/ }));
    expect(onChange).toHaveBeenCalledWith("2026-06-15");
  });
  it("uses Turkish month names, weekdays and Monday as the first day", async () => {
    await renderPicker();
    expect(screen.getByRole("combobox", { name: "Ayı seçin" })).toHaveTextContent("Haziran");
    expect(screen.getAllByRole("columnheader", { hidden: true })[0]).toHaveAttribute(
      "aria-label",
      "Pazartesi",
    );
    expect(screen.getByRole("button", { name: "Temizle" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bugün" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sonraki aya git" })).toBeInTheDocument();
  });
  it("stores a local ISO date and closes after a day is selected", async () => {
    const { user, onChange } = await renderPicker();
    await user.click(screen.getByRole("button", { name: /^5 Haziran 2026/ }));
    expect(onChange).toHaveBeenCalledWith("2026-06-05");
    expect(screen.getByRole("textbox", { name: "Başlangıç tarihi" })).toHaveValue("05/06/2026");
    expect(screen.queryByRole("combobox", { name: "Ayı seçin" })).not.toBeInTheDocument();
  });
  it("switches the open calendar when the application language changes", async () => {
    const { i18n } = await renderPicker();
    await act(() => i18n.changeLanguage("en"));
    expect(screen.getByRole("combobox", { name: "Choose the Month" })).toHaveTextContent("June");
    expect(screen.getByRole("textbox", { name: "Başlangıç tarihi" })).toHaveValue("01/06/2026");
    expect(screen.getByRole("button", { name: "Clear" })).toBeInTheDocument();
    expect(screen.getAllByRole("columnheader", { hidden: true })[0]).toHaveAttribute(
      "aria-label",
      "Sunday",
    );
  });
  it("navigates months and years without changing the selected date", async () => {
    const { user, onChange } = await renderPicker();
    await user.click(screen.getByRole("button", { name: "Sonraki aya git" }));
    expect(screen.getByRole("combobox", { name: "Ayı seçin" })).toHaveTextContent("Temmuz");
    await user.click(screen.getByRole("combobox", { name: "Yılı seçin" }));
    await user.click(screen.getByRole("option", { name: "2027" }));
    expect(screen.getByRole("combobox", { name: "Yılı seçin" })).toHaveTextContent("2027");
    await user.click(screen.getByRole("combobox", { name: "Ayı seçin" }));
    await user.click(screen.getByRole("option", { name: "Eylül" }));
    expect(screen.getByRole("combobox", { name: "Ayı seçin" })).toHaveTextContent("Eylül");
    expect(onChange).not.toHaveBeenCalled();
  });
  it("clears the value and allows required-field validation to run", async () => {
    const { user, onChange } = await renderPicker();
    await user.click(screen.getByRole("button", { name: "Temizle" }));
    expect(onChange).toHaveBeenCalledWith("");
  });
  it("shows a safe empty state for malformed legacy dates", async () => {
    await renderPicker("de", "invalid");
    expect(screen.getByRole("textbox", { name: "Başlangıç tarihi" })).toHaveValue("invalid");
    expect(screen.getByRole("textbox", { name: "Başlangıç tarihi" })).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(screen.getByRole("button", { name: "Leeren" })).toBeInTheDocument();
  });
});
