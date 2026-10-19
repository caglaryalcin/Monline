import { fireEvent, render, screen } from "@testing-library/react";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

import { CalendarPageHeader } from "./CalendarPageHeader";

describe("CalendarPageHeader", () => {
  it("opens historical payment entry", () => {
    const onAddHistorical = vi.fn();
    render(<CalendarPageHeader onAddHistorical={onAddHistorical} />);
    fireEvent.click(screen.getByRole("button", { name: "historical_add" }));
    expect(onAddHistorical).toHaveBeenCalledOnce();
  });
});
