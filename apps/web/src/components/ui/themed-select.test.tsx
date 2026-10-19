import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";

import { ThemedSelect } from "./themed-select";

beforeAll(() => {
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
  Element.prototype.scrollIntoView = () => {};
});

describe("ThemedSelect", () => {
  it("updates a controlled value through the native change handler and submits it once", async () => {
    const changed = vi.fn();
    function Example() {
      const [value, setValue] = useState("");
      return (
        <form aria-label="Import">
          <label htmlFor="bank">Bank</label>
          <ThemedSelect
            id="bank"
            name="bank"
            value={value}
            onChange={(event) => {
              changed(event.target.value);
              setValue(event.target.value);
            }}
          >
            <option value="">Automatic</option>
            <option value="enpara">Enpara</option>
            <option value="disabled" disabled>
              Unavailable
            </option>
          </ThemedSelect>
        </form>
      );
    }
    render(<Example />);
    const trigger = screen.getByRole("combobox", { name: "Bank" });
    expect(trigger).toHaveTextContent("Automatic");
    await userEvent.click(trigger);
    const available = screen.getByRole("option", { name: "Enpara" });
    await userEvent.pointer({ target: available, keys: "[MouseLeft]" });
    expect(changed).toHaveBeenCalledExactlyOnceWith("enpara");
    expect(trigger).toHaveTextContent("Enpara");
    const form = screen.getByRole("form") as HTMLFormElement;
    expect(new FormData(form).getAll("bank")).toEqual(["enpara"]);
    await userEvent.click(trigger);
    expect(screen.getByRole("option", { name: "Unavailable" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    await userEvent.click(screen.getByRole("option", { name: "Automatic" }));
    expect(changed).toHaveBeenLastCalledWith("");
    expect(trigger).toHaveTextContent("Automatic");
    expect(new FormData(form).getAll("bank")).toEqual([""]);
  });

  it("supports option text values, pointer highlighting and keyboard selection", async () => {
    render(
      <ThemedSelect aria-label="Currency" defaultValue="TRY">
        <option>TRY</option>
        <option>USD</option>
        <option disabled>EUR</option>
      </ThemedSelect>,
    );
    const trigger = screen.getByRole("combobox", { name: "Currency" });
    await userEvent.click(trigger);
    const usd = screen.getByRole("option", { name: "USD" });
    await userEvent.pointer({ target: usd });
    expect(usd).toHaveAttribute("data-highlighted");
    await userEvent.keyboard("{Enter}");
    expect(trigger).toHaveTextContent("USD");
    await userEvent.click(trigger);
    await userEvent.keyboard("{ArrowUp}{Enter}");
    expect(trigger).toHaveTextContent("TRY");
    await userEvent.click(trigger);
    await userEvent.pointer({ target: screen.getByRole("option", { name: "EUR" }) });
    expect(screen.getByRole("option", { name: "EUR" })).not.toHaveAttribute("data-highlighted");
    await userEvent.keyboard("{Escape}");
  });

  it("keeps disabled controls closed", async () => {
    render(
      <ThemedSelect aria-label="Bank" disabled>
        <option>Enpara</option>
      </ThemedSelect>,
    );
    const trigger = screen.getByRole("combobox", { name: "Bank" });
    expect(trigger).toBeDisabled();
    await userEvent.click(trigger);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });
});
