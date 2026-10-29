import { useMutation } from "@tanstack/react-query";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/lib/toast";
import type { AdminUser } from "@/services/adminUsers";
import { adminUsersService } from "@/services/adminUsers";

export function AdminUserDialog({
  user,
  onClose,
  onSaved,
}: {
  user: AdminUser | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [verified, setVerified] = useState(user?.verified ?? false);
  const [disabled, setDisabled] = useState(user?.disabled ?? false);
  const save = useMutation({
    mutationFn: () => {
      const data = {
        name: name.trim(),
        email: email.trim(),
        verified,
        disabled,
        ...(password || !user ? { password } : {}),
      };
      return user ? adminUsersService.update(user.id, data) : adminUsersService.create(data);
    },
    onSuccess: () => {
      setPassword("");
      toast.success(t("success"));
      onSaved();
      onClose();
    },
    onError: (error: Error) =>
      toast.error(t(error.message, { defaultValue: t("admin_users_request_failed") })),
  });
  return (
    <Dialog open onOpenChange={(open) => !open && !save.isPending && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t(user ? "admin_users_edit" : "admin_users_create")}</DialogTitle>
          <DialogDescription>{t("admin_users_edit_hint")}</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-5"
          onSubmit={(event) => {
            event.preventDefault();
            if (!save.isPending) save.mutate();
          }}
        >
          <fieldset className="space-y-4" disabled={save.isPending}>
            <div className="space-y-2">
              <Label htmlFor="admin-user-name">{t("name")}</Label>
              <Input
                id="admin-user-name"
                required
                maxLength={255}
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoComplete="off"
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-user-email">{t("email")}</Label>
              <Input
                id="admin-user-email"
                required
                type="email"
                maxLength={254}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="off"
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-user-password">
                {t(user ? "admin_users_new_password" : "password")}
              </Label>
              <div className="relative">
                <Input
                  id="admin-user-password"
                  type={showPassword ? "text" : "password"}
                  required={!user}
                  minLength={8}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="new-password"
                  className="rounded-xl pr-11"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1 h-8 w-8 text-muted-foreground"
                  onClick={() => setShowPassword((current) => !current)}
                  aria-label={t(
                    showPassword ? "admin_users_hide_password" : "admin_users_show_password",
                  )}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {t("admin_users_password_hint")}
              </p>
            </div>
            <div className="space-y-4 rounded-2xl border bg-muted/20 p-4">
              <div className="flex items-center justify-between gap-4">
                <Label htmlFor="admin-user-verified" className="space-y-1">
                  <span className="block">{t("admin_users_verified")}</span>
                  <span className="block text-xs font-normal leading-relaxed text-muted-foreground">
                    {t("admin_users_verified_hint")}
                  </span>
                </Label>
                <Switch
                  id="admin-user-verified"
                  checked={verified}
                  onCheckedChange={setVerified}
                  disabled={save.isPending}
                />
              </div>
              <div className="flex items-center justify-between gap-4 border-t pt-4">
                <Label htmlFor="admin-user-active" className="space-y-1">
                  <span className="block">{t("admin_users_account_active")}</span>
                  <span className="block text-xs font-normal leading-relaxed text-muted-foreground">
                    {t("admin_users_active_hint")}
                  </span>
                </Label>
                <Switch
                  id="admin-user-active"
                  checked={!disabled}
                  onCheckedChange={(active) => setDisabled(!active)}
                  disabled={save.isPending}
                />
              </div>
            </div>
          </fieldset>
          {save.isError && (
            <p role="alert" className="text-sm text-destructive">
              {t(save.error.message, { defaultValue: t("admin_users_request_failed") })}
            </p>
          )}
          <DialogFooter className="gap-2 sm:space-x-0">
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              disabled={save.isPending}
              onClick={onClose}
            >
              {t("cancel")}
            </Button>
            <Button
              type="submit"
              className="gap-2 rounded-xl"
              disabled={save.isPending || !name.trim() || !email.trim()}
            >
              {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {t("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
