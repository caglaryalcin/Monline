import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  AlertCircle,
  Check,
  ChevronDown,
  ExternalLink,
  Eye,
  Loader2,
  LockKeyhole,
  PencilLine,
  Plus,
  Share2,
  Trash2,
  UserRound,
  Users,
} from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { SharingRecipientsField } from "@/components/subscriptions/SharingRecipientsField";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { queryKeys } from "@/lib/queryKeys";
import { sharingErrorMessage } from "@/lib/sharingErrors";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { householdService } from "@/services/household";
import type { SharingGroup, SharingPermission, SubscriptionAccess } from "@/services/sharing";
import { parseSharingEmails, sharingKeys, sharingService } from "@/services/sharing";
import type { Subscription } from "@/types";

function PermissionChoices({
  id,
  label,
  permission,
  onChange,
  enabled = true,
  disabled = false,
  className,
}: {
  id: string;
  label: string;
  permission: SharingPermission;
  onChange: (permission: SharingPermission) => void;
  enabled?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  const { t } = useTranslation();
  return (
    <fieldset className={cn("grid grid-cols-2 gap-2", className)} disabled={!enabled || disabled}>
      <legend className="sr-only">{label}</legend>
      {(["read", "edit"] as const).map((value) => {
        const Icon = value === "read" ? Eye : PencilLine;
        return (
          <label key={value} className="min-w-0">
            <input
              type="radio"
              name={id}
              value={value}
              checked={permission === value}
              onChange={() => onChange(value)}
              className="peer sr-only"
            />
            <span
              className={cn(
                "flex h-full min-h-10 cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-medium transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-primary peer-focus-visible:ring-offset-2 peer-disabled:cursor-not-allowed peer-disabled:opacity-50 sm:text-sm",
                enabled
                  ? "border-border bg-muted/40 text-foreground"
                  : "border-border bg-background text-muted-foreground",
                enabled &&
                  "peer-checked:border-primary peer-checked:bg-primary peer-checked:text-primary-foreground",
              )}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span className="min-w-0 flex-1 leading-snug">
                {t(value === "read" ? "sharing_read_only" : "sharing_can_edit")}
              </span>
              <Check
                className={cn(
                  "h-3.5 w-3.5 shrink-0",
                  (!enabled || permission !== value) && "invisible",
                )}
                aria-hidden="true"
              />
            </span>
          </label>
        );
      })}
    </fieldset>
  );
}

function GroupAccessCard({
  group,
  enabled,
  permission,
  disabled,
  onEnabledChange,
  onPermissionChange,
  onRemove,
}: {
  group: SharingGroup;
  enabled: boolean;
  permission: SharingPermission;
  disabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  onPermissionChange: (permission: SharingPermission) => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div
      className={cn(
        "rounded-2xl border p-4 transition-colors",
        enabled
          ? "border-primary/70 bg-card text-card-foreground shadow-sm ring-1 ring-primary/15"
          : "border-border bg-muted/40",
      )}
    >
      <div className="flex items-center justify-between gap-4">
        <Label
          htmlFor={`sharing-group-${group.id}`}
          className="flex min-w-0 cursor-pointer items-center gap-3"
        >
          <span
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border",
              enabled
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border/60 bg-muted/40 text-muted-foreground",
            )}
          >
            <Users className="h-4 w-4" aria-hidden="true" />
          </span>
          <span className="min-w-0 space-y-1">
            <span className="block break-words text-sm font-semibold leading-snug">
              {group.name}
            </span>
            <span className="block text-xs font-normal text-muted-foreground">
              {t("sharing_group_type")} ·{" "}
              {t("sharing_member_count", { count: group.members.length })}
            </span>
            {!!group.pendingMembers?.length && (
              <span className="block text-xs text-muted-foreground">
                {t("sharing_pending_count", {
                  count: group.pendingMembers.length,
                })}
              </span>
            )}
          </span>
        </Label>
        <div className="flex h-9 shrink-0 items-center gap-2">
          <Switch
            id={`sharing-group-${group.id}`}
            checked={enabled}
            onCheckedChange={onEnabledChange}
            disabled={disabled}
            aria-label={`${group.name}: ${t("sharing_share")}`}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={disabled}
            onClick={onRemove}
            aria-label={t("sharing_remove_group_from_subscription", { name: group.name })}
            title={t("sharing_remove_group_from_subscription", { name: group.name })}
            className="h-9 w-9 self-center rounded-lg p-0 leading-none text-destructive/70 hover:text-destructive"
          >
            <Trash2 className="block h-5 w-5 shrink-0" aria-hidden="true" />
          </Button>
        </div>
      </div>
      <PermissionChoices
        id={`sharing-permission-${group.id}`}
        label={t("sharing_group_permission", { name: group.name })}
        permission={permission}
        enabled={enabled}
        disabled={disabled}
        onChange={onPermissionChange}
        className="mt-4"
      />
    </div>
  );
}

function AccessEditor({
  sub,
  userId,
  access,
  onClose,
}: {
  sub: Subscription;
  userId: string;
  access: SubscriptionAccess;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [sharingEnabled, setSharingEnabled] = useState(access.enabled !== false);
  const [emails, setEmails] = useState(access.users.map((user) => user.email.trim().toLowerCase()));
  const [emailDraft, setEmailDraft] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [selectedEmail, setSelectedEmail] = useState(emails[0] ?? "");
  const [peoplePickerOpen, setPeoplePickerOpen] = useState(false);
  const [userPermissions, setUserPermissions] = useState<Record<string, SharingPermission>>(
    access.userPermissions ?? {},
  );
  const [groupIds, setGroupIds] = useState(access.groups);
  const [groupPickerOpen, setGroupPickerOpen] = useState(false);
  const [groupEnabled, setGroupEnabled] = useState<Record<string, boolean>>(
    access.groupEnabled ?? {},
  );
  const [groupPermissions, setGroupPermissions] = useState<Record<string, SharingPermission>>(
    access.groupPermissions ?? {},
  );
  const [removedGroups, setRemovedGroups] = useState<
    Record<string, { selected: boolean; permission: SharingPermission; enabled: boolean }>
  >({});
  const groups = useQuery({
    queryKey: sharingKeys.groups(userId),
    queryFn: sharingService.groups,
    staleTime: 0,
  });
  const availableGroups = (groups.data ?? []).filter((group) => !groupIds.includes(group.id));
  const people = useQuery({
    queryKey: queryKeys.household.all(userId),
    queryFn: () => householdService.list(userId),
    enabled: !!userId,
    staleTime: 0,
    refetchOnWindowFocus: "always",
  });
  const linkedPeople = (people.data ?? []).filter(
    (person) =>
      person.account_confirmed &&
      person.account_id &&
      person.account_email &&
      person.account_id !== userId,
  );
  const directEmails = emails;
  const activeEmail = emails.includes(selectedEmail) ? selectedEmail : (emails[0] ?? "");
  const commitEmails = (raw: string): string[] | null => {
    const parsed = parseSharingEmails(raw);
    const values = [...new Set([...emails, ...parsed])];
    const invalid = parsed.some(
      (email) => email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
    );
    if (invalid || values.length > 100) {
      setEmailDraft(raw);
      setEmailError(invalid ? "sharing_invalid_email" : "sharing_invalid_users");
      return null;
    }
    setEmails(values);
    setEmailDraft("");
    setEmailError(null);
    if (parsed.length) setSelectedEmail(parsed[parsed.length - 1]);
    return values;
  };
  const removeEmail = (email: string) => {
    setEmails((current) => current.filter((value) => value !== email));
    setUserPermissions((current) =>
      Object.fromEntries(Object.entries(current).filter(([key]) => key !== email)),
    );
  };
  const removeGroup = (id: string) => {
    setPeoplePickerOpen(false);
    setRemovedGroups((current) => ({
      ...current,
      [id]: {
        selected: groupIds.includes(id),
        permission: groupPermissions[id] ?? "read",
        enabled: groupEnabled[id] !== false,
      },
    }));
    setGroupIds((current) => current.filter((value) => value !== id));
    setGroupPermissions((current) =>
      Object.fromEntries(Object.entries(current).filter(([key]) => key !== id)),
    );
    setGroupEnabled((current) =>
      Object.fromEntries(Object.entries(current).filter(([key]) => key !== id)),
    );
  };
  const addGroup = (id: string) => {
    setGroupIds((current) => [...new Set([...current, id])]);
    setGroupPermissions((current) => ({
      ...current,
      [id]: removedGroups[id]?.permission ?? "read",
    }));
    setGroupEnabled((current) => ({ ...current, [id]: true }));
    setRemovedGroups((current) =>
      Object.fromEntries(Object.entries(current).filter(([key]) => key !== id)),
    );
    setGroupPickerOpen(false);
  };
  const restoreGroups = () => {
    setGroupIds((current) => [
      ...new Set([
        ...current,
        ...Object.entries(removedGroups)
          .filter(([, group]) => group.selected)
          .map(([id]) => id),
      ]),
    ]);
    setGroupPermissions((current) => ({
      ...current,
      ...Object.fromEntries(
        Object.entries(removedGroups).map(([id, group]) => [id, group.permission]),
      ),
    }));
    setGroupEnabled((current) => ({
      ...current,
      ...Object.fromEntries(
        Object.entries(removedGroups).map(([id, group]) => [id, group.enabled]),
      ),
    }));
    setRemovedGroups({});
  };
  const recordAccess = (result: SubscriptionAccess) => {
    qc.setQueryData(sharingKeys.access(userId, sub.id), result);
    qc.setQueryData<Subscription[]>(queryKeys.subscriptions.all(userId), (current) =>
      current?.map((item) =>
        item.id === sub.id ? { ...item, is_shared: result.is_shared } : item,
      ),
    );
    qc.invalidateQueries({ queryKey: queryKeys.subscriptions.all(userId) });
    qc.invalidateQueries({ queryKey: ["shared-subscription-payers", userId] });
  };
  const toggle = useMutation({
    mutationFn: (enabled: boolean) => sharingService.setEnabled(sub.id, enabled),
    onSuccess: (result) => {
      setSharingEnabled(result.enabled !== false);
      recordAccess(result);
      toast.success(t(result.enabled === false ? "sharing_disabled" : "sharing_enabled"));
    },
    onError: (error: Error) => toast.error(sharingErrorMessage(t, error)),
  });
  const save = useMutation({
    mutationFn: (selectedEmails: string[]) => {
      const selectedGroupIds = groupIds.filter((id) =>
        groups.data?.some((group) => group.id === id),
      );
      return sharingService.saveAccess(
        sub.id,
        selectedEmails,
        selectedGroupIds,
        Object.fromEntries(selectedGroupIds.map((id) => [id, groupPermissions[id] ?? "read"])),
        Object.fromEntries(
          selectedEmails.map((email) => [email, userPermissions[email] ?? "read"]),
        ),
        Object.fromEntries(selectedGroupIds.map((id) => [id, groupEnabled[id] !== false])),
      );
    },
    onSuccess: (result) => {
      recordAccess(result);
      qc.invalidateQueries({ queryKey: queryKeys.household.all(userId) });
      qc.invalidateQueries({ queryKey: sharingKeys.groups(userId) });
      qc.invalidateQueries({ queryKey: ["shared-subscription-payers", userId] });
      if (result.invitation_delivery_failures)
        toast.error(t("people_invitation_delivery_failed_hint"));
      else toast.success(t(result.pending_count ? "sharing_saved_pending" : "sharing_saved"));
      onClose();
    },
    onError: (error: Error) => toast.error(sharingErrorMessage(t, error)),
  });
  return (
    <form
      className="flex min-h-0 flex-1 flex-col"
      onSubmit={(event) => {
        event.preventDefault();
        if (!sharingEnabled) {
          onClose();
          return;
        }
        if (!save.isPending && !toggle.isPending) {
          const recipients = commitEmails(emailDraft);
          if (recipients) save.mutate(recipients);
        }
      }}
    >
      <div className="min-h-0 space-y-6 overflow-y-auto px-5 py-5 sm:px-6">
        <div className="space-y-2 rounded-2xl border bg-muted/20 p-4">
          <div className="flex items-center justify-between gap-4">
            <Label
              htmlFor="subscription-sharing-enabled"
              className="cursor-pointer text-sm font-semibold"
            >
              {t(sharingEnabled ? "sharing_enabled" : "sharing_disabled")}
            </Label>
            <Switch
              id="subscription-sharing-enabled"
              checked={sharingEnabled}
              disabled={save.isPending || toggle.isPending}
              onCheckedChange={(enabled) => toggle.mutate(enabled)}
            />
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {t(sharingEnabled ? "sharing_enabled_hint" : "sharing_disabled_hint")}
          </p>
        </div>
        <fieldset
          className="min-w-0 space-y-3"
          disabled={
            save.isPending ||
            toggle.isPending ||
            !sharingEnabled ||
            groups.isPending ||
            groups.isError
          }
        >
          <legend className="sr-only">{t("sharing_groups")}</legend>
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
            <div className="flex items-center gap-2">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <Users className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                {t("sharing_groups_section")}
              </h3>
              {groupIds.length > 0 && (
                <span className="rounded-md bg-primary px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-primary-foreground">
                  {groupIds.length}
                </span>
              )}
            </div>
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="h-auto rounded-lg p-0 text-xs text-muted-foreground"
            >
              <Link
                to="/settings"
                search={{ tab: "groups" }}
                target="_blank"
                rel="noopener noreferrer"
              >
                {t("sharing_manage_groups")}
                <ExternalLink className="ml-1.5 h-3 w-3" aria-hidden="true" />
              </Link>
            </Button>
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {t("sharing_groups_section_hint")}
          </p>
          {availableGroups.length > 0 && (
            <DropdownMenu open={groupPickerOpen} onOpenChange={setGroupPickerOpen}>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  disabled={save.isPending || toggle.isPending || !sharingEnabled}
                  className="h-10 w-full justify-between rounded-xl px-3"
                >
                  <span className="inline-flex items-center gap-2">
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    {t("sharing_add_group")}
                  </span>
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 shrink-0 transition-transform",
                      groupPickerOpen && "rotate-180",
                    )}
                    aria-hidden="true"
                  />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                sideOffset={6}
                className="w-[var(--radix-dropdown-menu-trigger-width)] rounded-xl p-1.5"
              >
                {availableGroups.map((group) => (
                  <DropdownMenuItem
                    key={group.id}
                    disabled={save.isPending || toggle.isPending || !sharingEnabled}
                    className="cursor-pointer gap-2.5 rounded-lg px-3 py-2.5"
                    onSelect={() => addGroup(group.id)}
                  >
                    <Users className="h-4 w-4" aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-semibold">{group.name}</span>
                      <span className="block text-[11px] font-normal opacity-70">
                        {t("sharing_member_count", { count: group.members.length })}
                      </span>
                    </span>
                    <Plus className="h-4 w-4" aria-hidden="true" />
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {groups.isPending && (
            <div
              role="status"
              aria-label={t("loading")}
              className="h-32 animate-pulse rounded-2xl border bg-muted/30"
            />
          )}
          {groups.isError && (
            <p role="alert" className="text-destructive">
              {sharingErrorMessage(t, groups.error)}
            </p>
          )}
          {groups.data
            ?.filter((group) => groupIds.includes(group.id) && !removedGroups[group.id])
            .map((group) => (
              <GroupAccessCard
                key={group.id}
                group={group}
                enabled={groupEnabled[group.id] !== false}
                permission={groupPermissions[group.id] ?? "read"}
                disabled={save.isPending || toggle.isPending || !sharingEnabled}
                onEnabledChange={(enabled) =>
                  setGroupEnabled((current) => ({ ...current, [group.id]: enabled }))
                }
                onPermissionChange={(permission) =>
                  setGroupPermissions((current) => ({ ...current, [group.id]: permission }))
                }
                onRemove={() => removeGroup(group.id)}
              />
            ))}
          {Object.keys(removedGroups).length > 0 && (
            <div
              role="status"
              className="flex items-center justify-between gap-3 rounded-xl border bg-muted/20 p-3"
            >
              <p className="text-xs leading-relaxed text-muted-foreground">
                {t("sharing_group_removed_hint")}
              </p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={restoreGroups}
                disabled={save.isPending || toggle.isPending || !sharingEnabled}
                className="shrink-0 rounded-lg"
              >
                {t("sharing_undo_group_removal")}
              </Button>
            </div>
          )}
          {groups.data?.length === 0 && (
            <div className="flex items-center gap-3 rounded-2xl border border-dashed bg-muted/20 p-4">
              <Users className="h-5 w-5 shrink-0 text-muted-foreground/60" aria-hidden="true" />
              <p className="text-sm text-muted-foreground">{t("sharing_no_groups")}</p>
            </div>
          )}
          {groups.isSuccess &&
            groups.data.length > 0 &&
            groupIds.length === 0 &&
            Object.keys(removedGroups).length === 0 && (
              <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                {t("sharing_no_selected_groups")}
              </p>
            )}
        </fieldset>
        <div className="space-y-3 border-t pt-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label
              htmlFor="sharing-emails"
              className="flex items-center gap-2 text-sm font-semibold"
            >
              <UserRound className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              {t("sharing_accounts_section")}
            </Label>
            {linkedPeople.length > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-auto gap-1.5 rounded-lg px-2 py-1 text-xs text-muted-foreground"
                disabled={save.isPending || toggle.isPending || !sharingEnabled}
                aria-expanded={peoplePickerOpen}
                aria-controls="sharing-people-picker"
                onClick={() => setPeoplePickerOpen((current) => !current)}
              >
                <UserRound className="h-3.5 w-3.5" aria-hidden="true" />
                {t(peoplePickerOpen ? "sharing_hide_people_picker" : "sharing_pick_people")}
              </Button>
            )}
          </div>
          {peoplePickerOpen && linkedPeople.length > 0 && (
            <div id="sharing-people-picker" className="space-y-3 rounded-xl border bg-muted/20 p-3">
              <p className="text-xs leading-relaxed text-muted-foreground">
                {t("sharing_people_picker_hint")}
              </p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {linkedPeople.map((person) => {
                  const email = person.account_email!.trim().toLowerCase();
                  const selected = directEmails.includes(email);
                  return (
                    <Button
                      key={person.id}
                      type="button"
                      variant="outline"
                      disabled={save.isPending || toggle.isPending || !sharingEnabled}
                      aria-pressed={selected}
                      className={cn(
                        "h-auto min-w-0 justify-start gap-2.5 rounded-xl px-3 py-2.5 text-left",
                        selected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-background",
                      )}
                      onClick={() =>
                        selected
                          ? removeEmail(email)
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
            </div>
          )}
          <SharingRecipientsField
            emails={emails}
            draft={emailDraft}
            permissions={userPermissions}
            selectedEmail={activeEmail}
            pendingEmails={access.users
              .filter((user) => user.status === "pending")
              .map((user) => user.email.toLowerCase())}
            disabled={save.isPending || toggle.isPending || !sharingEnabled}
            error={emailError}
            onDraftChange={(value) => {
              setEmailDraft(value);
              setEmailError(null);
            }}
            onCommit={commitEmails}
            onSelect={setSelectedEmail}
            onRemove={removeEmail}
          />
          {activeEmail && (
            <div className="space-y-2 rounded-xl border bg-card p-3">
              <p className="truncate text-xs font-medium" title={activeEmail}>
                {t("sharing_person_permission", { email: activeEmail })}
              </p>
              <PermissionChoices
                id="sharing-person-permission"
                label={t("sharing_person_permission", { email: activeEmail })}
                permission={userPermissions[activeEmail] ?? "read"}
                disabled={save.isPending || toggle.isPending || !sharingEnabled}
                onChange={(permission) =>
                  setUserPermissions((current) => ({ ...current, [activeEmail]: permission }))
                }
              />
              {groupIds.some((id) => groupEnabled[id] !== false) && (
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  {t("sharing_permission_priority")}
                </p>
              )}
            </div>
          )}
          <p id="sharing-emails-hint" className="text-xs leading-relaxed text-muted-foreground">
            {t("sharing_accounts_section_hint")}
          </p>
          <Link
            to="/settings"
            search={{ tab: "household" }}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground underline underline-offset-4"
          >
            {t("household_manage_account_links")}
            <ExternalLink className="h-3 w-3" aria-hidden="true" />
          </Link>
        </div>
        <div className="flex items-start gap-2.5 text-xs leading-relaxed text-muted-foreground">
          <LockKeyhole className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <p>
            <span className="font-medium text-foreground/80">
              {t(
                sharingEnabled &&
                  (groupIds.some((id) => groupEnabled[id] !== false) || directEmails.length)
                  ? "sharing_selected_access"
                  : "sharing_only_you",
              )}
            </span>
            <br />
            {t("sharing_content_hint")}
          </p>
        </div>
        {save.isError && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <p>{sharingErrorMessage(t, save.error)}</p>
          </div>
        )}
      </div>
      <DialogFooter className="shrink-0 gap-2 border-t bg-muted/20 px-5 py-4 sm:space-x-0 sm:px-6">
        <Button
          type="button"
          variant="outline"
          className="rounded-xl"
          onClick={onClose}
          disabled={save.isPending || toggle.isPending}
        >
          {t("cancel")}
        </Button>
        <Button
          type="submit"
          className="gap-2 rounded-xl px-5"
          disabled={save.isPending || toggle.isPending || (sharingEnabled && !groups.isSuccess)}
        >
          {save.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {t(sharingEnabled ? "save" : "close")}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function SubscriptionSharingDialog({
  sub,
  userId,
  onClose,
}: {
  sub: Subscription;
  userId: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const access = useQuery({
    queryKey: sharingKeys.access(userId, sub.id),
    queryFn: () => sharingService.access(sub.id),
    staleTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-xl sm:p-0">
        <DialogHeader className="shrink-0 border-b px-5 py-5 pr-12 sm:px-6 sm:pr-12">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-primary bg-primary text-primary-foreground">
              <Share2 className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0 space-y-1.5">
              <DialogTitle>{t("sharing_share")}</DialogTitle>
              <p className="truncate text-sm text-muted-foreground" title={sub.name}>
                {sub.name}
              </p>
            </div>
          </div>
          <DialogDescription className="pt-2 text-xs leading-relaxed">
            {t("sharing_dialog_description")}
          </DialogDescription>
        </DialogHeader>
        {access.isPending && (
          <div
            role="status"
            className="flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground"
          >
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            {t("loading")}
          </div>
        )}
        {access.isError && (
          <p role="alert" className="px-6 py-5 text-sm text-destructive">
            {sharingErrorMessage(t, access.error)}
          </p>
        )}
        {access.isSuccess && !access.isFetching && (
          <AccessEditor sub={sub} userId={userId} access={access.data} onClose={onClose} />
        )}
      </DialogContent>
    </Dialog>
  );
}
