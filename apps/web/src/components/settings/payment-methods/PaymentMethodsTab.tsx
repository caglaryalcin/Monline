import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Edit2,
  GripVertical,
  Plus,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { IconPicker } from "@/components/settings/payment-methods/IconPicker";
import { PaymentMethodIcon } from "@/components/settings/payment-methods/PaymentMethodIcon";
import {
  BulkSettingsActions,
  SelectionCheckbox,
} from "@/components/settings/shared/BulkSettingsActions";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/contexts/AuthContext";
import { queryKeys } from "@/lib/queryKeys";
import { toast } from "@/lib/toast";
import { paymentMethodsService } from "@/services/paymentMethods";
import type { PaymentMethod } from "@/types";

export function PaymentMethodsTab() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const qc = useQueryClient();

  const [isAdding, setIsAdding] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [newName, setNewName] = useState("");
  const [newIconFile, setNewIconFile] = useState<File | null>(null);
  const [newIconPreview, setNewIconPreview] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editIconFile, setEditIconFile] = useState<File | null>(null);
  const [editIconPreview, setEditIconPreview] = useState<string | null>(null);
  const [editClearIcon, setEditClearIcon] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const { data: methods = [], isLoading } = useQuery({
    queryKey: queryKeys.paymentMethods.all(user?.id ?? ""),
    queryFn: () => paymentMethodsService.list(user!.id),
    enabled: !!user?.id,
  });

  function resetAddForm() {
    setNewName("");
    if (newIconPreview) URL.revokeObjectURL(newIconPreview);
    setNewIconFile(null);
    setNewIconPreview(null);
    setIsAdding(false);
  }

  function resetEditState() {
    setEditingId(null);
    setEditingName("");
    if (editIconPreview) URL.revokeObjectURL(editIconPreview);
    setEditIconFile(null);
    setEditIconPreview(null);
    setEditClearIcon(false);
  }

  const createMut = useMutation({
    mutationFn: (data: { name: string; file: File | null }) => {
      const fd = new FormData();
      fd.append("name", data.name);
      fd.append("user", user!.id);
      fd.append("order", String(methods.length));
      if (data.file) fd.append("icon", data.file);
      return paymentMethodsService.create(fd);
    },
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: queryKeys.paymentMethods.all(user?.id ?? ""),
      });
      resetAddForm();
      toast.success(t("success_create"));
    },
    onError: () => toast.error(t("error")),
  });

  const updateMut = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Partial<PaymentMethod> & {
        _file?: File | null;
        _clearIcon?: boolean;
      };
    }) => {
      const { _file, _clearIcon, ...rest } = data;
      if (_file || _clearIcon) {
        const fd = new FormData();
        for (const [k, v] of Object.entries(rest)) {
          if (v !== undefined) fd.append(k, String(v));
        }
        if (_file) fd.append("icon", _file);
        if (_clearIcon) fd.append("icon-", "icon"); // Monline: "field-" to delete file
        return paymentMethodsService.update(id, fd);
      }
      return paymentMethodsService.update(id, rest);
    },
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: queryKeys.paymentMethods.all(user?.id ?? ""),
      });
      resetEditState();
      toast.success(t("success_update"));
    },
    onError: () => toast.error(t("error")),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => paymentMethodsService.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: queryKeys.paymentMethods.all(user?.id ?? ""),
      });
      toast.success(t("success_delete"));
    },
    onError: () => toast.error(t("error")),
  });
  const setMainMut = useMutation({
    mutationFn: (id: string) => paymentMethodsService.update(id, { is_main: true }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.paymentMethods.all(user?.id ?? "") });
      toast.success(t("success_update"));
    },
    onError: () => toast.error(t("error")),
  });

  const handleAdd = () => {
    if (!newName.trim()) return;
    createMut.mutate({ name: newName, file: newIconFile });
  };

  const handleUpdateName = (id: string) => {
    if (!editingName.trim()) return;
    updateMut.mutate({
      id,
      data: {
        name: editingName,
        _file: editIconFile,
        _clearIcon: editClearIcon,
      },
    });
  };

  const handleReorder = (sourceIndex: number, destinationIndex: number) => {
    if (
      sourceIndex < 0 ||
      destinationIndex < 0 ||
      destinationIndex >= methods.length ||
      destinationIndex === sourceIndex
    )
      return;

    const reordered = Array.from(methods);
    const [moved] = reordered.splice(sourceIndex, 1);
    reordered.splice(destinationIndex, 0, moved);

    // Optimistic update
    qc.setQueryData<PaymentMethod[]>(
      queryKeys.paymentMethods.all(user?.id ?? ""),
      reordered.map((method, order) => ({ ...method, order })),
    );

    // Persist only items whose order changed
    reordered.forEach((m, i) => {
      if (m.order !== i) {
        paymentMethodsService.update(m.id, { order: i }).catch(() => {
          qc.invalidateQueries({
            queryKey: queryKeys.paymentMethods.all(user?.id ?? ""),
          });
        });
      }
    });
  };

  const startEdit = (method: PaymentMethod) => {
    setEditingId(method.id);
    setEditingName(method.name);
    setEditIconFile(null);
    setEditIconPreview(null);
    setEditClearIcon(false);
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-start justify-end">
        {!isAdding && (
          <Button onClick={() => setIsAdding(true)} className="rounded-xl">
            <Plus className="w-4 h-4 mr-2" />
            {t("add")}
          </Button>
        )}
      </div>

      <Separator />
      <BulkSettingsActions
        items={methods.map((method) => ({
          id: method.id,
          label: method.name,
          values: { name: method.name },
        }))}
        fields={[{ key: "name", label: t("payment_method_name_placeholder"), required: true }]}
        selected={selected}
        onSelect={setSelected}
        onUpdate={(id, data) => paymentMethodsService.update(id, data)}
        onDelete={(id) => paymentMethodsService.delete(id)}
        onChanged={() => {
          void qc.invalidateQueries();
        }}
      />

      <div className="space-y-3">
        {isAdding && (
          <div className="flex flex-col gap-3 p-4 rounded-2xl border border-border bg-card">
            <div className="flex items-center gap-3">
              <Input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={t("payment_method_name_placeholder")}
                className="rounded-xl border-input bg-background text-sm focus-visible:ring-ring"
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              />
              <Button
                size="icon"
                variant="ghost"
                className="shrink-0 text-primary"
                onClick={handleAdd}
              >
                <Check className="w-5 h-5" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="shrink-0 text-muted-foreground"
                onClick={resetAddForm}
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
            <IconPicker
              name={newName}
              currentSrc={newIconPreview}
              hasUploadedIcon={!!newIconFile}
              onFileChange={(file, url) => {
                if (newIconPreview) URL.revokeObjectURL(newIconPreview);
                setNewIconFile(file);
                setNewIconPreview(url);
              }}
              onClear={() => {
                if (newIconPreview) URL.revokeObjectURL(newIconPreview);
                setNewIconFile(null);
                setNewIconPreview(null);
              }}
            />
          </div>
        )}

        {isLoading ? (
          <div className="settings-item-grid">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 rounded-2xl bg-muted/50 animate-pulse" />
            ))}
          </div>
        ) : methods.length === 0 && !isAdding ? (
          <div className="text-center py-12 border border-dashed rounded-3xl text-muted-foreground">
            <CreditCard className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p>{t("no_payment_methods")}</p>
          </div>
        ) : (
          <div className="settings-item-grid">
            {methods.map((method, idx) => (
              <div
                key={method.id}
                onDragOver={(event) => {
                  if (draggingId && editingId !== method.id) {
                    event.preventDefault();
                    event.dataTransfer.dropEffect = "move";
                  }
                }}
                onDrop={(event) => {
                  if (!draggingId || editingId === method.id) return;
                  event.preventDefault();
                  handleReorder(
                    methods.findIndex((item) => item.id === draggingId),
                    idx,
                  );
                  setDraggingId(null);
                }}
                className={`flex min-h-32 min-w-0 flex-col justify-between gap-3 p-4 rounded-2xl border bg-card transition-colors group ${
                  draggingId === method.id ? "shadow-lg ring-2 ring-primary/30 bg-muted/50" : ""
                }`}
              >
                {editingId === method.id ? (
                  <div className="flex flex-col w-full gap-3">
                    <div className="flex items-center gap-3">
                      <Input
                        autoFocus
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        className="min-w-0 flex-1 border-muted bg-background focus-visible:ring-primary h-10 text-sm"
                        onKeyDown={(e) => e.key === "Enter" && handleUpdateName(method.id)}
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 shrink-0 text-primary"
                        aria-label={t("save")}
                        onClick={() => handleUpdateName(method.id)}
                      >
                        <Check className="w-5 h-5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 shrink-0"
                        aria-label={t("cancel")}
                        onClick={resetEditState}
                      >
                        <X className="w-5 h-5" />
                      </Button>
                    </div>
                    <IconPicker
                      name={editingName}
                      currentSrc={
                        editClearIcon
                          ? null
                          : (editIconPreview ?? paymentMethodsService.iconUrl(method))
                      }
                      hasUploadedIcon={!editClearIcon && (!!editIconFile || !!method.icon)}
                      onFileChange={(file, url) => {
                        if (editIconPreview) URL.revokeObjectURL(editIconPreview);
                        setEditIconFile(file);
                        setEditIconPreview(url);
                        setEditClearIcon(false);
                      }}
                      onClear={() => {
                        if (editIconPreview) URL.revokeObjectURL(editIconPreview);
                        setEditIconFile(null);
                        setEditIconPreview(null);
                        setEditClearIcon(true);
                      }}
                    />
                  </div>
                ) : (
                  <>
                    <div className="flex w-full min-w-0 items-center gap-2">
                      <SelectionCheckbox
                        name={method.name}
                        checked={selected.has(method.id)}
                        onChange={() =>
                          setSelected((current) => {
                            const next = new Set(current);
                            if (next.has(method.id)) next.delete(method.id);
                            else next.add(method.id);
                            return next;
                          })
                        }
                      />
                      <button
                        type="button"
                        draggable
                        aria-label={t("payment_method_reorder_hint", { name: method.name })}
                        title={t("payment_method_reorder_hint", { name: method.name })}
                        onDragStart={(event) => {
                          event.dataTransfer.effectAllowed = "move";
                          event.dataTransfer.setData("text/plain", method.id);
                          setDraggingId(method.id);
                        }}
                        onDragEnd={() => setDraggingId(null)}
                        onKeyDown={(event) => {
                          const direction = ["ArrowLeft", "ArrowUp"].includes(event.key)
                            ? -1
                            : ["ArrowRight", "ArrowDown"].includes(event.key)
                              ? 1
                              : 0;
                          if (!direction) return;
                          event.preventDefault();
                          handleReorder(idx, idx + direction);
                        }}
                        className="shrink-0 rounded p-1 text-muted-foreground focus-visible:outline focus-visible:outline-ring cursor-grab active:cursor-grabbing"
                      >
                        <GripVertical className="w-4 h-4" />
                      </button>
                      <PaymentMethodIcon method={method} size={48} />
                      <span className="min-w-0 flex-1 break-words text-sm font-medium">
                        {method.name}
                      </span>
                      <Button
                        size="icon"
                        variant="ghost"
                        className={
                          method.is_main
                            ? "h-8 w-8 shrink-0 text-primary"
                            : "h-8 w-8 shrink-0 text-muted-foreground"
                        }
                        aria-label={t(
                          method.is_main ? "main_payment_method" : "set_as_main_payment_method",
                        )}
                        title={t(
                          method.is_main ? "main_payment_method" : "set_as_main_payment_method",
                        )}
                        aria-pressed={!!method.is_main}
                        disabled={!!method.is_main || setMainMut.isPending}
                        onClick={() => setMainMut.mutate(method.id)}
                      >
                        <Star className={`h-4 w-4 ${method.is_main ? "fill-current" : ""}`} />
                      </Button>
                    </div>
                    <div className="flex w-full shrink-0 items-center justify-between gap-2">
                      <div className="flex gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-muted-foreground"
                          disabled={idx === 0}
                          aria-label={t("payment_method_move_previous")}
                          title={t("payment_method_move_previous")}
                          onClick={() => handleReorder(idx, idx - 1)}
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-muted-foreground"
                          disabled={idx === methods.length - 1}
                          aria-label={t("payment_method_move_next")}
                          title={t("payment_method_move_next")}
                          onClick={() => handleReorder(idx, idx + 1)}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-muted-foreground "
                          aria-label={t("edit")}
                          onClick={() => startEdit(method)}
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-destructive/70 "
                          aria-label={t("delete")}
                          onClick={() => {
                            setPendingDeleteId(method.id);
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      <ConfirmDialog
        confirmOnEnter
        open={!!pendingDeleteId}
        onOpenChange={(open) => {
          if (!open) setPendingDeleteId(null);
        }}
        title={t("delete")}
        description={t("confirm_delete")}
        onConfirm={() => {
          if (!pendingDeleteId) return;
          deleteMut.mutate(pendingDeleteId);
          setPendingDeleteId(null);
        }}
      />
    </div>
  );
}
