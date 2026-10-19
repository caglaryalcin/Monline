import { Edit2, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "@/lib/toast";

type Item = { id: string; label: string; values: Record<string, string> };
type Field = { key: string; label: string; required?: boolean };
interface Props {
  items: Item[];
  fields: Field[];
  selected: Set<string>;
  onSelect: (ids: Set<string>) => void;
  onUpdate: (id: string, values: Record<string, string>) => Promise<unknown>;
  onDelete: (id: string) => Promise<unknown>;
  onChanged: () => void;
}

export function BulkSettingsActions({
  items,
  fields,
  selected,
  onSelect,
  onUpdate,
  onDelete,
  onChanged,
}: Props) {
  const { t } = useTranslation();
  const [drafts, setDrafts] = useState<Item[] | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const selectedItems = items.filter((item) => selected.has(item.id));
  const allSelected = items.length > 0 && selectedItems.length === items.length;

  async function apply(action: "update" | "delete") {
    const targets = action === "update" ? (drafts ?? []) : selectedItems;
    setBusy(true);
    try {
      const results = await Promise.allSettled(
        targets.map(async (item) => {
          if (action === "delete") return onDelete(item.id);
          const original = items.find((entry) => entry.id === item.id);
          const changed = Object.fromEntries(
            Object.entries(item.values)
              .map(([key, value]) => [key, value.trim()])
              .filter(([key, value]) => original?.values[key] !== value),
          );
          if (Object.keys(changed).length) return onUpdate(item.id, changed);
        }),
      );
      const failed = targets.filter((_, index) => results[index].status === "rejected");
      onSelect(new Set(failed.map((item) => item.id)));
      if (action === "update") setDrafts(failed.length ? failed : null);
      setConfirmDelete(false);
      if (failed.length) toast.error(t("bulk_partial_failure", { count: failed.length }));
      else toast.success(t(action === "delete" ? "success_delete" : "success_update"));
    } finally {
      onChanged();
      setBusy(false);
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            className="h-4 w-4 accent-primary"
            disabled={!items.length || busy}
            checked={allSelected}
            onChange={() =>
              onSelect(allSelected ? new Set() : new Set(items.map((item) => item.id)))
            }
          />
          {t("select_all")}
        </label>
        {selectedItems.length > 0 && (
          <>
            <span className="text-sm text-muted-foreground">
              {t("selected_items", { count: selectedItems.length })}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() =>
                setDrafts(selectedItems.map((item) => ({ ...item, values: { ...item.values } })))
              }
            >
              <Edit2 className="mr-2 h-4 w-4" />
              {t("edit_selected")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-destructive"
              disabled={busy}
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {t("delete_selected")}
            </Button>
          </>
        )}
      </div>
      <Dialog
        open={drafts !== null}
        onOpenChange={(open) => {
          if (!open && !busy) setDrafts(null);
        }}
      >
        <DialogContent className="max-h-[85dvh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("edit_selected")}</DialogTitle>
            <DialogDescription>{t("bulk_edit_hint")}</DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (!busy) void apply("update");
            }}
          >
            <fieldset disabled={busy} className="space-y-3">
              {drafts?.map((item, index) => (
                <div key={item.id} className="space-y-3 rounded-xl border bg-card p-4">
                  <p className="text-sm font-semibold">{item.label}</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {fields.map((field) => (
                      <label key={field.key} className="space-y-1.5 text-xs text-muted-foreground">
                        {field.label}
                        <Input
                          aria-label={`${item.label} · ${field.label}`}
                          required={field.required}
                          value={item.values[field.key] ?? ""}
                          onChange={(event) =>
                            setDrafts(
                              (current) =>
                                current?.map((entry, row) =>
                                  row === index
                                    ? {
                                        ...entry,
                                        values: {
                                          ...entry.values,
                                          [field.key]: event.target.value,
                                        },
                                      }
                                    : entry,
                                ) ?? null,
                            )
                          }
                        />
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </fieldset>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => setDrafts(null)}
              >
                {t("cancel")}
              </Button>
              <Button
                type="submit"
                disabled={
                  busy ||
                  drafts?.some((item) =>
                    fields.some((field) => field.required && !item.values[field.key]?.trim()),
                  )
                }
              >
                {t(busy ? "loading" : "save")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        confirmOnEnter
        open={confirmDelete}
        onOpenChange={(open) => {
          if (!busy) setConfirmDelete(open);
        }}
        title={t("delete_selected")}
        description={t("confirm_delete_selected", { count: selectedItems.length })}
        onConfirm={() => {
          if (!busy) void apply("delete");
        }}
      />
    </>
  );
}

export function SelectionCheckbox({
  name,
  checked,
  onChange,
  disabled,
}: {
  name: string;
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <input
      type="checkbox"
      aria-label={t("select_item", { name })}
      className="h-4 w-4 shrink-0 cursor-pointer accent-primary disabled:cursor-not-allowed disabled:opacity-30"
      checked={checked}
      onChange={onChange}
      disabled={disabled}
    />
  );
}
