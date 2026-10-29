import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Users } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { HouseholdMemberFormRow } from "@/components/settings/household/HouseholdMemberFormRow";
import { HouseholdMemberListItem } from "@/components/settings/household/HouseholdMemberListItem";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/contexts/AuthContext";
import { queryKeys } from "@/lib/queryKeys";
import { toast } from "@/lib/toast";
import { householdService } from "@/services/household";

export function HouseholdTab() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const qc = useQueryClient();

  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingEmail, setEditingEmail] = useState("");
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const { data: members = [], isLoading } = useQuery({
    queryKey: queryKeys.household.all(user?.id ?? ""),
    queryFn: () => householdService.list(user!.id),
    enabled: !!user?.id,
    staleTime: 0,
    refetchOnWindowFocus: "always",
    refetchInterval: (query) =>
      query.state.data?.some((person) => person.invitation_status === "pending") ? 15000 : false,
  });

  const createMut = useMutation({
    mutationFn: ({ name, email }: { name: string; email: string }) =>
      householdService.create(user!.id, name, email),
    onSuccess: (person) => {
      qc.invalidateQueries({
        queryKey: queryKeys.household.all(user?.id ?? ""),
      });
      setNewName("");
      setNewEmail("");
      setIsAdding(false);
      if (person.invitation_status === "delivery_failed")
        toast.error(t("people_invitation_delivery_failed_hint"));
      else toast.success(t(person.account_confirmed ? "success_create" : "people_invitation_sent"));
    },
    onError: (error: Error) => toast.error(t(error.message, { defaultValue: t("error") })),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, name, email }: { id: string; name: string; email: string }) =>
      householdService.update(id, { name, account_email: email }),
    onSuccess: (person) => {
      qc.invalidateQueries({
        queryKey: queryKeys.household.all(user?.id ?? ""),
      });
      qc.invalidateQueries({ queryKey: queryKeys.subscriptions.all(user?.id ?? "") });
      qc.invalidateQueries({ queryKey: ["shared-subscription-payers", user?.id ?? ""] });
      setEditingId(null);
      if (person.invitation_status === "delivery_failed")
        toast.error(t("people_invitation_delivery_failed_hint"));
      else toast.success(t("success_update"));
    },
    onError: (error: Error) => toast.error(t(error.message, { defaultValue: t("error") })),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => householdService.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: queryKeys.household.all(user?.id ?? ""),
      });
      qc.invalidateQueries({ queryKey: queryKeys.subscriptions.all(user?.id ?? "") });
      qc.invalidateQueries({ queryKey: ["sharing-groups", user?.id ?? ""] });
      qc.invalidateQueries({ queryKey: ["subscription-access", user?.id ?? ""] });
      qc.invalidateQueries({ queryKey: ["shared-subscription-payers", user?.id ?? ""] });
      toast.success(t("success_delete"));
    },
    onError: () => toast.error(t("error")),
  });
  const setMainMut = useMutation({
    mutationFn: (id: string) => householdService.update(id, { is_main: true }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.household.all(user?.id ?? "") });
      toast.success(t("success_update"));
    },
    onError: () => toast.error(t("error")),
  });
  const resendMut = useMutation({
    mutationFn: householdService.resendInvitation,
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: queryKeys.household.all(user?.id ?? "") });
      if (result.invitation_status === "delivery_failed")
        toast.error(t("people_invitation_delivery_failed_hint"));
      else toast.success(t("people_invitation_sent"));
    },
    onError: (error: Error) => toast.error(t(error.message, { defaultValue: t("error") })),
  });

  const handleAdd = () => {
    if (!newEmail.trim()) return;
    createMut.mutate({ name: newName.trim(), email: newEmail.trim() });
  };

  const handleUpdate = (id: string) => {
    if (!editingEmail.trim()) return;
    updateMut.mutate({ id, name: editingName.trim(), email: editingEmail.trim() });
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
          {t("household_accounts_description")}
        </p>
        {!isAdding && (
          <Button
            onClick={() => {
              createMut.reset();
              setIsAdding(true);
            }}
            className="rounded-xl"
          >
            <Plus className="w-4 h-4 mr-2" />
            {t("add")}
          </Button>
        )}
      </div>

      <Separator />

      <div className="space-y-3">
        {isAdding && (
          <HouseholdMemberFormRow
            accountEmail={newEmail}
            onAccountEmailChange={setNewEmail}
            pending={createMut.isPending}
            error={
              createMut.isError
                ? t(createMut.error.message, { defaultValue: t("error") })
                : undefined
            }
            name={newName}
            onNameChange={setNewName}
            onSubmit={handleAdd}
            onCancel={() => setIsAdding(false)}
          />
        )}

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 rounded-2xl bg-muted/50 animate-pulse" />
            ))}
          </div>
        ) : members.length === 0 && !isAdding ? (
          <div className="text-center py-12 border border-dashed rounded-3xl text-muted-foreground">
            <Users className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p>{t("no_household_members")}</p>
          </div>
        ) : (
          members.map((member) =>
            editingId === member.id ? (
              <HouseholdMemberFormRow
                accountEmail={editingEmail}
                onAccountEmailChange={setEditingEmail}
                pending={updateMut.isPending}
                error={
                  updateMut.isError
                    ? t(updateMut.error.message, { defaultValue: t("error") })
                    : undefined
                }
                key={member.id}
                name={editingName}
                onNameChange={setEditingName}
                onSubmit={() => handleUpdate(member.id)}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <HouseholdMemberListItem
                accountEmail={member.account_email}
                accountConfirmed={member.account_confirmed}
                invitationStatus={member.invitation_status}
                onResend={() => resendMut.mutate(member.id)}
                resendPending={resendMut.isPending}
                key={member.id}
                memberName={member.name}
                isMain={!!member.is_main}
                mainPending={setMainMut.isPending}
                onSetMain={
                  member.account_confirmed ? () => setMainMut.mutate(member.id) : undefined
                }
                onEdit={() => {
                  updateMut.reset();
                  setEditingId(member.id);
                  setEditingName(member.name);
                  setEditingEmail(member.account_email ?? "");
                }}
                onDelete={
                  member.account_id === user?.id
                    ? undefined
                    : () => setPendingDeleteId(member.id)
                }
              />
            ),
          )
        )}
      </div>

      <ConfirmDialog
        confirmOnEnter
        open={!!pendingDeleteId}
        onOpenChange={(open) => {
          if (!open) setPendingDeleteId(null);
        }}
        title={t("delete")}
        description={t("household_delete_sharing_hint")}
        onConfirm={() => {
          if (!pendingDeleteId) return;
          deleteMut.mutate(pendingDeleteId);
          setPendingDeleteId(null);
        }}
      />
    </div>
  );
}
