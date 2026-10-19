import { render, screen } from "@testing-library/react";

import { createQueryClientWrapper } from "@/test/query-client";

import { SecurityTab } from "./SecurityTab";

let isAdmin = false;
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "user-1" }, refreshUser: vi.fn(), isAdmin }),
}));
vi.mock("@/components/settings/two-factor/TwoFactorTab", () => ({
  TwoFactorTab: ({ children }: { children?: React.ReactNode }) => (
    <div>Two factor settings{children}</div>
  ),
}));
vi.mock("@/components/settings/registration/RegistrationTab", () => ({
  RegistrationTab: ({ section }: { section?: string }) => (
    <div>{section === "limits" ? "Limits and URLs settings" : "Registration settings"}</div>
  ),
}));

it("keeps password and 2FA settings visible and restricts registration settings to administrators", () => {
  isAdmin = false;
  const { Wrapper } = createQueryClientWrapper();
  const { rerender } = render(<SecurityTab />, { wrapper: Wrapper });
  expect(screen.getByRole("heading", { name: "change_password" })).toBeInTheDocument();
  expect(screen.getByText("Two factor settings")).toBeInTheDocument();
  expect(screen.queryByText("Registration settings")).not.toBeInTheDocument();
  expect(screen.queryByText("Limits and URLs settings")).not.toBeInTheDocument();
  isAdmin = true;
  rerender(<SecurityTab />);
  expect(screen.getByRole("heading", { name: "registration" })).toBeInTheDocument();
  expect(screen.getByText("Registration settings")).toBeInTheDocument();
  expect(screen.getByText("Limits and URLs settings")).toBeInTheDocument();
});
