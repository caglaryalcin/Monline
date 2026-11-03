import { useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { categoryLabel } from "@/lib/categoryLabel";
import { queryKeys } from "@/lib/queryKeys";
import { toast } from "@/lib/toast";
import { categoriesService } from "@/services/categories";
import type { Category } from "@/types";

const CREATE_CATEGORY = "__create_category__";

export function SubscriptionCategorySelect({
  userId,
  categories,
  value,
  onChange,
  onBlur,
  onCreated,
  onCreatingChange,
  disabled,
  invalid,
  describedBy,
}: {
  userId: string;
  categories: Category[];
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  onCreated: (category: Category) => void;
  onCreatingChange: (creating: boolean) => void;
  disabled?: boolean;
  invalid?: boolean;
  describedBy?: string;
}) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const inputId = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const saving = useRef(false);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (adding) input.current?.focus();
  }, [adding]);

  const closeEditor = () => {
    setAdding(false);
    setName("");
    setError("");
    trigger.current?.focus();
  };

  const createCategory = async () => {
    if (disabled || saving.current) return;
    const trimmed = name.trim();
    if (!trimmed) {
      setError(t("required"));
      return;
    }
    const language = (i18n?.resolvedLanguage || i18n?.language || "en").replace("_", "-");
    const normalize = (value: string) => value.trim().normalize("NFKC").toLocaleLowerCase(language);
    const existing = categories.find((category) =>
      [category.name, categoryLabel(category, t)].some(
        (label) => normalize(label) === normalize(trimmed),
      ),
    );
    if (existing) {
      onChange(existing.id);
      closeEditor();
      return;
    }
    saving.current = true;
    setCreating(true);
    onCreatingChange(true);
    setError("");
    try {
      const category = await categoriesService.create(userId, trimmed);
      const queryKey = queryKeys.categories.all(userId);
      await queryClient.cancelQueries({ queryKey });
      queryClient.setQueryData<Category[]>(queryKey, (current = []) =>
        [...current.filter((item) => item.id !== category.id), category].sort((a, b) =>
          a.name.localeCompare(b.name),
        ),
      );
      onCreated(category);
      closeEditor();
      toast.success(t("success_create"));
      void queryClient.invalidateQueries({ queryKey });
    } catch {
      setError(t("failed_add_category"));
    } finally {
      saving.current = false;
      setCreating(false);
      onCreatingChange(false);
    }
  };

  return (
    <div className="space-y-3">
      <Select
        required
        value={value}
        disabled={disabled || creating}
        onValueChange={(next) => {
          if (next === CREATE_CATEGORY) {
            setAdding(true);
            setError("");
          } else onChange(next);
        }}
      >
        <SelectTrigger
          ref={trigger}
          id="subscription-category"
          aria-label={t("category")}
          aria-required="true"
          aria-invalid={invalid}
          aria-describedby={describedBy}
          onBlur={onBlur}
        >
          <SelectValue placeholder="" />
        </SelectTrigger>
        <SelectContent
          onCloseAutoFocus={(event) => {
            if (adding) {
              event.preventDefault();
              input.current?.focus();
            }
          }}
        >
          <SelectItem value={CREATE_CATEGORY} className="font-medium text-primary">
            <span className="inline-flex items-center gap-2">
              <Plus className="h-4 w-4" aria-hidden="true" />
              {t("subscription_add_category")}
            </span>
          </SelectItem>
          {categories.length > 0 && <SelectSeparator />}
          {categories.map((category) => (
            <SelectItem key={category.id} value={category.id}>
              {categoryLabel(category, t)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {adding && (
        <div
          className="space-y-2 rounded-xl border bg-muted/20 p-3"
          role="group"
          aria-labelledby={`${inputId}-label`}
        >
          <Label id={`${inputId}-label`} htmlFor={inputId}>
            {t("subscription_new_category_name")}
          </Label>
          <Input
            ref={input}
            id={inputId}
            value={name}
            maxLength={100}
            placeholder={t("category_name_placeholder")}
            disabled={disabled || creating}
            aria-invalid={!!error}
            aria-describedby={error ? `${inputId}-error` : undefined}
            onChange={(event) => {
              setName(event.target.value);
              setError("");
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.nativeEvent.isComposing) {
                event.preventDefault();
                event.stopPropagation();
                void createCategory();
              } else if (event.key === "Escape") {
                event.preventDefault();
                event.stopPropagation();
                if (!creating) closeEditor();
              }
            }}
          />
          {error && (
            <p id={`${inputId}-error`} role="alert" className="text-xs text-destructive">
              {error}
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={disabled || creating}
              onClick={closeEditor}
            >
              {t("cancel")}
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={disabled || creating || !name.trim()}
              onClick={() => void createCategory()}
            >
              {creating ? t("saving") : t("add")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
