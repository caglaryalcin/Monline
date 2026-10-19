import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { Save } from "lucide-react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { RegistrationTab } from "@/components/settings/registration/RegistrationTab";
import {
  buildPasswordSchema,
  type PasswordFormValues,
} from "@/components/settings/security/security.schema";
import { TwoFactorTab } from "@/components/settings/two-factor/TwoFactorTab";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/contexts/AuthContext";
import { queryKeys } from "@/lib/queryKeys";
import { toast } from "@/lib/toast";
import { usersService } from "@/services/users";

export function SecurityTab() {
  const { t } = useTranslation();
  const { user, refreshUser, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PasswordFormValues>({
    resolver: zodResolver(buildPasswordSchema(t)),
    defaultValues: { oldPwd: "", newPwd: "", confPwd: "" },
  });

  async function changePassword(data: PasswordFormValues) {
    if (!user) return;
    try {
      const body = new FormData();
      body.set("oldPassword", data.oldPwd);
      body.set("password", data.newPwd);
      body.set("passwordConfirm", data.confPwd);
      await usersService.update(user.id, body);
      reset();
      await refreshUser();
      await queryClient.invalidateQueries({ queryKey: queryKeys.user() });
      toast.success(t("saved"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    }
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <form
        onSubmit={handleSubmit(changePassword)}
        className="min-w-0 space-y-4"
        aria-labelledby="security-password-heading"
      >
        <div>
          <h3 id="security-password-heading" className="text-lg font-semibold">
            {t("change_password")}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">{t("password_security_hint")}</p>
        </div>
        <div className="flex min-w-0 flex-col gap-4">
          {(
            [
              { name: "oldPwd", label: "old_password", autoComplete: "current-password" },
              { name: "newPwd", label: "new_password", autoComplete: "new-password" },
              { name: "confPwd", label: "confirm_password", autoComplete: "new-password" },
            ] as const
          ).map((field) => (
            <div key={field.name} className="grid gap-2">
              <Label htmlFor={`security-${field.name}`}>{t(field.label)}</Label>
              <Input
                id={`security-${field.name}`}
                type="password"
                autoComplete={field.autoComplete}
                disabled={isSubmitting}
                aria-invalid={!!errors[field.name]}
                aria-describedby={errors[field.name] ? `security-${field.name}-error` : undefined}
                {...register(field.name)}
                className="rounded-xl border-white/5 bg-muted/50 focus:bg-background"
              />
              {errors[field.name] && (
                <p id={`security-${field.name}-error`} className="text-sm text-destructive">
                  {errors[field.name]?.message}
                </p>
              )}
            </div>
          ))}
          <div className="flex justify-end pt-2">
            <Button type="submit" disabled={isSubmitting || !user} className="rounded-xl">
              <Save className="mr-2 h-4 w-4" />
              {t("change_password")}
            </Button>
          </div>
        </div>
      </form>
      <Separator />
      <section className="min-w-0 space-y-4" aria-labelledby="security-two-factor-heading">
        <h3 id="security-two-factor-heading" className="text-lg font-semibold">
          {t("two_factor_auth")}
        </h3>
        <TwoFactorTab />
      </section>
      {isAdmin && (
        <>
          <Separator />
          <div className="settings-security-grid">
            <div className="min-w-0">
              <RegistrationTab section="limits" />
            </div>
            <section className="min-w-0 space-y-4" aria-labelledby="security-registration-heading">
              <h3 id="security-registration-heading" className="text-lg font-semibold">
                {t("registration")}
              </h3>
              <RegistrationTab section="registration" />
            </section>
          </div>
        </>
      )}
    </div>
  );
}
