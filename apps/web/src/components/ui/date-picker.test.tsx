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

async function renderPicker(language = "tr", value = "2026-06-01") {
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
  await user.click(screen.getByRole("button", { name: /^Başlangıç tarihi:/ }));
  return { user, i18n, onChange };
}

describe("localized date picker", () => {
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
    expect(screen.getByRole("button", { name: /^Başlangıç tarihi:/ })).toHaveTextContent(
      "05/06/2026",
    );
    expect(screen.queryByRole("combobox", { name: "Ayı seçin" })).not.toBeInTheDocument();
  });
  it("switches the open calendar when the application language changes", async () => {
    const { i18n } = await renderPicker();
    await act(() => i18n.changeLanguage("en"));
    expect(screen.getByRole("combobox", { name: "Choose the Month" })).toHaveTextContent("June");
    expect(screen.getByRole("button", { name: /^Başlangıç tarihi:/ })).toHaveTextContent(
      "01/06/2026",
    );
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
    expect(screen.getByRole("button", { name: /^Başlangıç tarihi:/ })).toHaveTextContent("—");
    expect(screen.getByRole("button", { name: "Leeren" })).toBeInTheDocument();
  });
});
