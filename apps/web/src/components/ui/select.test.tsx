import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "./select";

// Radix Select uses pointer capture APIs not available in JSDOM
beforeAll(() => {
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
  // Radix Select also calls scrollIntoView when opening the dropdown
  Element.prototype.scrollIntoView = () => {};
});

describe("Select primitives", () => {
  it("keeps scroll-button areas at both ends so clicking an exhausted arrow cannot select an option", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <Select defaultValue="b" onValueChange={onValueChange}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="a">Alpha</SelectItem>
          <SelectItem value="b">Beta</SelectItem>
          <SelectItem value="c">Gamma</SelectItem>
        </SelectContent>
      </Select>,
    );
    await user.click(screen.getByRole("combobox"));
    const list = await screen.findByRole("listbox");
    const viewport = list.querySelector<HTMLElement>("[data-radix-select-viewport]")!;
    Object.defineProperties(viewport, {
      clientHeight: { configurable: true, value: 64 },
      scrollHeight: { configurable: true, value: 320 },
    });
    fireEvent.scroll(viewport, { target: { scrollTop: 32 } });
    await waitFor(() =>
      expect(list.querySelector('[data-select-scroll-button="up"]')).not.toBeNull(),
    );
    const upSlot = list.querySelector<HTMLElement>('[data-select-scroll-slot="up"]')!;
    const downSlot = list.querySelector<HTMLElement>('[data-select-scroll-slot="down"]')!;

    fireEvent.scroll(viewport, { target: { scrollTop: 0 } });
    await waitFor(() => expect(list.querySelector('[data-select-scroll-button="up"]')).toBeNull());
    await user.click(upSlot);
    expect(screen.getByRole("listbox")).toBeVisible();
    expect(onValueChange).not.toHaveBeenCalled();

    fireEvent.scroll(viewport, { target: { scrollTop: 256 } });
    await waitFor(() =>
      expect(list.querySelector('[data-select-scroll-button="down"]')).toBeNull(),
    );
    expect(list.querySelector('[data-select-scroll-slot="up"]')).toBe(upSlot);
    expect(list.querySelector('[data-select-scroll-slot="down"]')).toBe(downSlot);
    await user.click(downSlot);
    expect(onValueChange).not.toHaveBeenCalled();
    await user.click(screen.getByRole("option", { name: "Gamma" }));
    expect(onValueChange).toHaveBeenCalledExactlyOnceWith("c");
  });

  it("renders the trigger with a placeholder", () => {
    render(
      <Select>
        <SelectTrigger>
          <SelectValue placeholder="Pick one" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="a">Option A</SelectItem>
        </SelectContent>
      </Select>,
    );
    expect(screen.getByText("Pick one")).toBeInTheDocument();
  });

  it("trigger renders with h-10 w-full classes", () => {
    render(
      <Select>
        <SelectTrigger>
          <SelectValue placeholder="X" />
        </SelectTrigger>
      </Select>,
    );
    expect(screen.getByRole("combobox")).toHaveClass("h-10", "w-full");
  });

  it("trigger is disabled when the disabled prop is set", () => {
    render(
      <Select disabled>
        <SelectTrigger>
          <SelectValue placeholder="X" />
        </SelectTrigger>
      </Select>,
    );
    expect(screen.getByRole("combobox")).toBeDisabled();
  });

  it("trigger merges a custom className", () => {
    render(
      <Select>
        <SelectTrigger className="custom-trigger">
          <SelectValue placeholder="X" />
        </SelectTrigger>
      </Select>,
    );
    expect(screen.getByRole("combobox")).toHaveClass("custom-trigger");
  });

  it("opens the listbox when the trigger is clicked", async () => {
    render(
      <Select>
        <SelectTrigger>
          <SelectValue placeholder="Pick" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="a">Alpha</SelectItem>
          <SelectItem value="b">Beta</SelectItem>
        </SelectContent>
      </Select>,
    );
    await userEvent.click(screen.getByRole("combobox"));
    expect(await screen.findByText("Alpha")).toBeInTheDocument();
    expect(screen.getByText("Beta")).toBeInTheDocument();
  });

  it("calls onValueChange with the selected item's value", async () => {
    const onValueChange = vi.fn();
    render(
      <Select onValueChange={onValueChange}>
        <SelectTrigger>
          <SelectValue placeholder="Pick" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="a">Alpha</SelectItem>
        </SelectContent>
      </Select>,
    );
    await userEvent.click(screen.getByRole("combobox"));
    await userEvent.click(await screen.findByText("Alpha"));
    expect(onValueChange).toHaveBeenCalledWith("a");
  });

  it("displays the selected value in the trigger", () => {
    render(
      <Select defaultValue="b">
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="a">Alpha</SelectItem>
          <SelectItem value="b">Beta</SelectItem>
        </SelectContent>
      </Select>,
    );
    expect(screen.getByText("Beta")).toBeInTheDocument();
  });

  it("SelectLabel renders with font-semibold inside a SelectGroup", async () => {
    render(
      <Select>
        <SelectTrigger>
          <SelectValue placeholder="X" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>My Group</SelectLabel>
            <SelectItem value="a">Option A</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>,
    );
    await userEvent.click(screen.getByRole("combobox"));
    expect(await screen.findByText("My Group")).toHaveClass("font-semibold");
  });

  it("SelectSeparator renders with bg-muted class when content is open", async () => {
    render(
      <Select>
        <SelectTrigger>
          <SelectValue placeholder="X" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="a">A</SelectItem>
          <SelectSeparator data-testid="sep" />
          <SelectItem value="b">B</SelectItem>
        </SelectContent>
      </Select>,
    );
    await userEvent.click(screen.getByRole("combobox"));
    expect(await screen.findByTestId("sep")).toHaveClass("bg-muted");
  });
});
