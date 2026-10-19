import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ProfileAvatarCard } from "./ProfileAvatarCard";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

describe("ProfileAvatarCard", () => {
  it("shows the administrator badge and permissions only for administrator accounts", () => {
    const props = {
      displayName: "Daniel",
      fileRef: { current: null },
      preview: null,
      onFileChange: vi.fn(),
    };
    const { rerender } = render(<ProfileAvatarCard {...props} isAdmin />);
    expect(screen.getByText("admin")).toBeInTheDocument();
    expect(screen.getByText("admin_account_description")).toBeInTheDocument();
    rerender(<ProfileAvatarCard {...props} isAdmin={false} />);
    expect(screen.queryByText("admin")).not.toBeInTheDocument();
    expect(screen.queryByText("admin_account_description")).not.toBeInTheDocument();
  });
  it("renders the fallback initial and opens the file picker from both triggers", async () => {
    const fileRef = { current: null as HTMLInputElement | null };
    const clickSpy = vi.spyOn(HTMLInputElement.prototype, "click");

    render(
      <ProfileAvatarCard
        displayName="Daniel"
        email="daniel@example.com"
        fileRef={fileRef}
        preview={null}
        onFileChange={vi.fn()}
      />,
    );

    expect(screen.getByText("D")).toBeInTheDocument();

    await userEvent.click(screen.getAllByRole("button", { name: "change_avatar" })[2]);
    await userEvent.click(screen.getAllByRole("button")[0]);

    expect(clickSpy).toHaveBeenCalledTimes(2);
    clickSpy.mockRestore();
  });

  it("clicking the camera overlay button also opens the file picker", async () => {
    const fileRef = { current: null as HTMLInputElement | null };
    const clickSpy = vi.spyOn(HTMLInputElement.prototype, "click");

    render(
      <ProfileAvatarCard
        displayName="Alice"
        email="alice@example.com"
        fileRef={fileRef}
        preview={null}
        onFileChange={vi.fn()}
      />,
    );

    // buttons: [0] = avatar circle, [1] = camera overlay, [2] = change_avatar
    const buttons = screen.getAllByRole("button");
    await userEvent.click(buttons[1]);

    expect(clickSpy).toHaveBeenCalledTimes(1);
    clickSpy.mockRestore();
  });

  it("renders the preview image and forwards the selected file", async () => {
    const onFileChange = vi.fn();
    const fileRef = { current: null as HTMLInputElement | null };
    const file = new File(["avatar"], "avatar.png", { type: "image/png" });

    const { container } = render(
      <ProfileAvatarCard
        displayName="Daniel"
        email="daniel@example.com"
        fileRef={fileRef}
        preview="https://example.com/avatar.png"
        onFileChange={onFileChange}
      />,
    );

    expect(screen.getByRole("img", { name: "Daniel" })).toHaveAttribute(
      "src",
      "https://example.com/avatar.png",
    );

    await userEvent.upload(container.querySelector('input[type="file"]') as HTMLInputElement, file);

    expect(onFileChange).toHaveBeenCalledWith(file);
  });
});
