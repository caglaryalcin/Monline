import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";

import { SubscriptionCategorySelect } from "@/components/subscriptions/SubscriptionCategorySelect";
import { queryKeys } from "@/lib/queryKeys";
import type { Category } from "@/types";
const mocks = vi.hoisted(() => ({ create: vi.fn(), submit: vi.fn() }));
vi.mock("@/services/categories", () => ({ categoriesService: { create: mocks.create } }));
vi.mock("@/lib/toast", () => ({ toast: { success: vi.fn() } }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key === "category_default_ai" ? "Yapay Zeka" : key, i18n: { language: "tr" } }) }));
const original = { id: "old", user: "user", name: "AI", translation_key: "ai" } as Category;
const added = { id: "new", user: "user", name: "Custom", translation_key: "" } as Category;
function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(queryKeys.categories.all("user"), [original]);
  function Harness() {
    const [categories, setCategories] = useState([original]);
    const [value, setValue] = useState(original.id);
    const [creating, setCreating] = useState(false);
    return <form onSubmit={(e) => { e.preventDefault(); mocks.submit(); }}><input aria-label="draft" defaultValue="Unsaved subscription" /><SubscriptionCategorySelect userId="user" categories={categories} value={value} onChange={setValue} onBlur={() => {}} onCreated={(category) => { setCategories((old) => [...old, category]); setValue(category.id); }} onCreatingChange={setCreating} disabled={creating} /><output aria-label="selected">{value}</output></form>;
  }
  render(<QueryClientProvider client={client}><Harness /></QueryClientProvider>);
  return client;
}
async function openEditor() {
  await userEvent.click(screen.getByRole("combobox"));
  await userEvent.click(await screen.findByRole("option", { name: "subscription_add_category" }));
  return screen.getByRole("textbox", { name: "subscription_new_category_name" });
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.create.mockResolvedValue(added);
  Element.prototype.scrollIntoView = () => {};
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
});
it("creates and selects a category on Enter without submitting or losing the subscription draft", async () => {
  const client = mount();
  const input = await openEditor();
  await userEvent.type(input, "  Custom  {Enter}");
  await vi.waitFor(() => expect(screen.getByLabelText("selected")).toHaveTextContent("new"));
  expect(mocks.create).toHaveBeenCalledWith("user", "Custom");
  expect(client.getQueryData(queryKeys.categories.all("user"))).toEqual([original, added]);
  expect(screen.getByRole("textbox", { name: "draft" })).toHaveValue("Unsaved subscription");
  expect(mocks.submit).not.toHaveBeenCalled();
});
it("selects an existing translated category instead of creating a duplicate", async () => {
  mount();
  await userEvent.type(await openEditor(), "yapay zeka{Enter}");
  await vi.waitFor(() => expect(screen.queryByRole("textbox", { name: "subscription_new_category_name" })).not.toBeInTheDocument());
  expect(screen.getByLabelText("selected")).toHaveTextContent("old");
  expect(mocks.create).not.toHaveBeenCalled();
  expect(mocks.submit).not.toHaveBeenCalled();
});
it("keeps the entered category and subscription draft after a failed creation", async () => {
  mocks.create.mockRejectedValue(new Error("offline"));
  mount();
  await userEvent.type(await openEditor(), "Custom{Enter}");
  expect(await screen.findByRole("alert")).toHaveTextContent("failed_add_category");
  expect(screen.getByRole("textbox", { name: "subscription_new_category_name" })).toHaveValue("Custom");
  expect(screen.getByRole("textbox", { name: "draft" })).toHaveValue("Unsaved subscription");
  expect(screen.getByLabelText("selected")).toHaveTextContent("old");
  expect(mocks.submit).not.toHaveBeenCalled();
});
it("Escape closes only the category editor", async () => {
  mount();
  await userEvent.type(await openEditor(), "Custom{Escape}");
  expect(screen.queryByRole("textbox", { name: "subscription_new_category_name" })).not.toBeInTheDocument();
  expect(screen.getByRole("textbox", { name: "draft" })).toHaveValue("Unsaved subscription");
  expect(mocks.create).not.toHaveBeenCalled();
});
