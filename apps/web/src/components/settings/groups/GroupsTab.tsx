import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, UserRound } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { SharingRecipientsField } from "@/components/subscriptions/SharingRecipientsField";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { queryKeys } from "@/lib/queryKeys";
import { sharingErrorMessage } from "@/lib/sharingErrors";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { householdService } from "@/services/household";
import type { SharingGroup } from "@/services/sharing";
import { parseSharingEmails, sharingKeys, sharingService } from "@/services/sharing";

export function GroupsTab() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<SharingGroup | "new" | null>(null);
  const [name, setName] = useState("");
  const [emails, setEmails] = useState<string[]>([]);
  const [emailDraft, setEmailDraft] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [selectedEmail, setSelectedEmail] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const {
    data: groups = [],
    isPending,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: sharingKeys.groups(user?.id ?? ""),
    queryFn: sharingService.groups,
    enabled: !!user,
    staleTime: 0,
    refetchOnWindowFocus: "always",
    refetchInterval: (query) =>
      query.state.data?.some((group) => group.pendingMembers?.length) ? 15000 : false,
  });
  const people = useQuery({
    queryKey: queryKeys.household.all(user?.id ?? ""),
    queryFn: () => householdService.list(user!.id),
    enabled: !!user?.id,
    staleTime: 0,
    refetchOnWindowFocus: "always",
  });
  const confirmedPeople = (people.data ?? []).filter(
    (person) =>
      person.account_confirmed &&
      person.account_id &&
      person.account_email &&
      person.account_id !== user?.id,
  );
  const confirmedEmails = confirmedPeople.map((person) => person.account_email!.toLowerCase());
  const commitEmails = (raw: string): string[] | null => {
    const parsed = parseSharingEmails(raw);
    const selected = [...new Set([...emails, ...parsed])];
    const invalid = parsed.some(
      (email) => email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
    );
    if (invalid || selected.length > 100) {
      setEmailDraft(raw);
      setEmailError(invalid ? "sharing_invalid_email" : "sharing_invalid_users");
      return null;
    }
    setEmails(selected);
    setEmailDraft("");
    setEmailError(null);
    if (parsed.length) setSelectedEmail(parsed[parsed.length - 1]);
    return selected;
  };
  const refresh = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: sharingKeys.groups(user?.id ?? "") }),
      qc.invalidateQueries({ queryKey: queryKeys.subscriptions.all(user?.id ?? "") }),
      qc.invalidateQueries({ queryKey: queryKeys.household.all(user?.id ?? "") }),
    ]);
  const save = useMutation({
    mutationFn: (selectedEmails: string[]) =>
      sharingService.saveGroup(
        editing && editing !== "new" ? editing.id : null,
        name,
        selectedEmails,
      ),
    onSuccess: (result) => {
      setEditing(null);
      refresh();
      if (result.invitation_delivery_failures)
        toast.error(t("people_invitation_delivery_failed_hint"));
      else toast.success(t(result.pendingMembers?.length ? "sharing_saved_pending" : "success"));
    },
    onError: (error: Error) => toast.error(sharingErrorMessage(t, error)),
  });
  const remove = useMutation({
    mutationFn: (id: string) => sharingService.deleteGroup(id),
    onSuccess: () => {
      setDeleteId(null);
      refresh();
      toast.success(t("success"));
    },
    onError: (error: Error) => toast.error(sharingErrorMessage(t, error)),
  });
  const edit = (group: SharingGroup | "new") => {
    save.reset();
    setEditing(group);
    setName(group === "new" ? "" : group.name);
    setEmails(
      group === "new"
        ? []
        : [...group.members, ...(group.pendingMembers ?? [])].map((member) =>
            member.email.toLowerCase(),
          ),
    );
    setEmailDraft("");
    setEmailError(null);
    setSelectedEmail("");
  };
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">{t("sharing_groups")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("sharing_groups_hint")}</p>
        </div>
        <Button onClick={() => edit("new")} disabled={!!editing}>
          {t("sharing_create_group")}
        </Button>
      </div>
      {editing && (
        <form
          className="space-y-4 rounded-xl border p-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!save.isPending) {
              const selected = commitEmails(emailDraft);
              if (selected) save.mutate(selected);
            }
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="group-name">{t("sharing_group_name")}</Label>
            <Input
              id="group-name"
              value={name}
              maxLength={100}
              required
              onChange={(event) => setName(event.target.value)}
              disabled={save.isPending}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="group-members">{t("sharing_member_emails")}</Label>
            {confirmedPeople.length > 0 && (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {confirmedPeople.map((person) => {
                  const email = person.account_email!.toLowerCase();
                  const selected = emails.includes(email);
                  return (
                    <Button
                      key={person.id}
                      type="button"
                      variant="outline"
                      disabled={save.isPending}
                      aria-pressed={selected}
                      className={cn(
                        "h-auto min-w-0 justify-start gap-2.5 rounded-xl px-3 py-2.5 text-left",
                        selected && "border-primary bg-primary text-primary-foreground",
                      )}
                      onClick={() =>
                        selected
                          ? setEmails((current) => current.filter((value) => value !== email))
                          : commitEmails([emailDraft, email].filter(Boolean).join("\n"))
                      }
                    >
                      <UserRound className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-semibold">{person.name}</span>
                        <span className="block truncate text-[11px] font-normal opacity-75">
                          {person.account_email}
                        </span>
                      </span>
                      {selected && <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
                    </Button>
                  );
                })}
              </div>
            )}
            <SharingRecipientsField
              inputId="group-members"
              emails={emails}
              draft={emailDraft}
              permissions={{}}
              selectedEmail={selectedEmail}
              pendingEmails={
                people.isSuccess ? emails.filter((email) => !confirmedEmails.includes(email)) : []
              }
              confirmedEmails={confirmedEmails}
              showPermissions={false}
              disabled={save.isPending}
              error={emailError}
              onDraftChange={(value) => {
                setEmailDraft(value);
                setEmailError(null);
              }}
              onCommit={commitEmails}
              onSelect={setSelectedEmail}
              onRemove={(email) =>
                setEmails((current) => current.filter((value) => value !== email))
              }
            />
            <p id="group-members-hint" className="text-sm text-muted-foreground">
              {t("sharing_group_contacts_hint")}
            </p>
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={save.isPending || !name.trim()}>
              {t("save")}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditing(null)}
              disabled={save.isPending}
            >
              {t("cancel")}
            </Button>
          </div>
          {save.isError && (
            <p role="alert" className="text-sm text-destructive">
              {sharingErrorMessage(t, save.error)}
            </p>
          )}
        </form>
      )}
      {isPending && <p role="status">{t("loading")}</p>}
      {isError && (
        <div className="space-y-2">
          <p role="alert" className="text-destructive">
            {sharingErrorMessage(t, error)}
          </p>
          <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
            {t("sharing_refresh")}
          </Button>
        </div>
      )}
      {!isPending && !isError && groups.length === 0 && (
        <p className="rounded-xl border border-dashed p-6 text-muted-foreground">
          {t("sharing_no_groups")}
        </p>
      )}
      {groups.map((group) => (
        <div
          key={group.id}
          className="flex flex-wrap items-center justify-between gap-4 rounded-xl border p-4"
        >
          <div className="min-w-0">
            <h3 className="font-medium break-words">{group.name}</h3>
            <p className="text-sm text-muted-foreground break-all">
              {group.members.map((member) => member.email).join(", ") || t("sharing_no_members")}
            </p>
            {!!group.pendingMembers?.length && (
              <p className="mt-1 text-xs text-muted-foreground">
                {t("people_invitation_pending")}:{" "}
                {group.pendingMembers.map((member) => member.email).join(", ")}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => edit(group)}
              disabled={!!editing || remove.isPending}
            >
              {t("edit")}
            </Button>
            <Button
              variant="destructive"
              onClick={() => setDeleteId(group.id)}
              disabled={remove.isPending}
            >
              {t("delete")}
            </Button>
          </div>
        </div>
      ))}
      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title={t("sharing_delete_group")}
        description={t("sharing_delete_group_hint")}
        onConfirm={() => {
          if (deleteId && !remove.isPending) remove.mutate(deleteId);
        }}
      />
    </div>
  );
}
