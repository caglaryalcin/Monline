import type { Category } from "@/types";

/** Only seeded categories have a stable translation key. User names are literal. */
export function categoryLabel(
  category: Pick<Category, "name" | "translation_key">,
  t: (key: string, options?: { defaultValue: string }) => string,
): string {
  return category.translation_key
    ? t(
        category.translation_key.startsWith("statement_")
          ? `statement_category_${category.translation_key.slice(10)}`
          : `category_default_${category.translation_key}`,
        { defaultValue: category.name },
      )
    : category.name;
}
