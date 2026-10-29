import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";

import { LogoWithName } from "@/components/AppLogo";
import { LanguagePicker } from "@/components/auth/LanguagePicker";
import { OIDCLoginButton } from "@/components/auth/OIDCLoginButton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { SS_KEYS } from "@/lib/constants";
import { toast } from "@/lib/toast";
import { isTotpRequiredError } from "@/services/auth";
import { oidcService } from "@/services/oidc";
import { registrationService } from "@/services/registration";

type LoginForm = {
  email: string;
  password: string;
};

export function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { login } = useAuth();
  const [remember, setRemember] = useState(false);
  const [oidcProviderName, setOidcProviderName] = useState<string | null>(null);
  // null until the server answers, so a closed instance never flashes the link.
  const [registrationOpen, setRegistrationOpen] = useState<boolean | null>(null);

  const schema = z.object({
    email: z.string().min(1, t("required")).email(t("validation_invalid_email")),
    password: z.string().min(1, t("required")),
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: LoginForm) => {
    try {
      await login(data.email, data.password, remember);
      navigate({ to: "/dashboard", replace: true });
    } catch (err: unknown) {
      if (isTotpRequiredError(err)) {
        sessionStorage.setItem(SS_KEYS.TOTP_LOGIN_CHALLENGE, JSON.stringify(err.challenge));
        navigate({ to: "/totp", replace: true });
        return;
      }

      const msg = err instanceof Error ? err.message : t("unknown_error");
      toast.error(msg === "account_disabled" ? t("account_disabled") : msg);
    }
  };

  useEffect(() => {
    fetch("/api/auth/bootstrap-status", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.hasUsers === false) {
          navigate({ to: "/setup", replace: true });
        }
      })
      .catch(() => {});
  }, [navigate]);

  useEffect(() => {
    registrationService
      .isOpen()
      .then(setRegistrationOpen)
      // The backend enforces the policy on the create request either way, so
      // an unreachable check falls back to offering the link.
      .catch(() => setRegistrationOpen(true));
  }, []);

  // The OIDC settings are admin-only, so the login page asks the public
  // endpoint whether an SSO provider is configured.
  useEffect(() => {
    oidcService
      .getConfig()
      .then((config) => {
        if (config.enabled) setOidcProviderName(config.providerName);
      })
      .catch(() => {});
  }, []);

  return (
    <div className="monline-login flex flex-col items-center bg-background">
      <Card className="my-auto w-full max-w-md shrink-0">
        <CardHeader className="p-5 text-center sm:p-6">
          <div className="flex justify-center mb-2">
            <LogoWithName className="h-10 w-auto" />
          </div>
          <LanguagePicker />
        </CardHeader>
        <CardContent className="px-5 pb-5 sm:px-6 sm:pb-6">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">{t("email")}</Label>
              <Input
                id="email"
                type="email"
                inputMode="email"
                autoCapitalize="none"
                autoCorrect="off"
                autoComplete="email"
                className="h-11 sm:h-10"
                {...register("email")}
              />
              {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t("password")}</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                className="h-11 sm:h-10"
                {...register("password")}
              />
              {errors.password && (
                <p className="text-sm text-destructive">{errors.password.message}</p>
              )}
              <div className="flex justify-end pt-1 text-sm">
                <Link
                  to="/password-reset"
                  className="inline-flex min-h-11 items-center text-right text-muted-foreground sm:min-h-0"
                >
                  {t("forgot_password")}
                </Link>
              </div>
            </div>
            <div className="flex items-start gap-[11px] rounded-xl border bg-muted/40 px-3.5 py-[13px] has-[:disabled]:opacity-60">
              <input
                id="remember-login"
                type="checkbox"
                checked={remember}
                disabled={isSubmitting}
                aria-describedby="remember-login-hint"
                onChange={(event) => setRemember(event.target.checked)}
                className="mt-0.5 h-[18px] w-[18px] shrink-0 cursor-pointer accent-primary disabled:cursor-not-allowed"
              />
              <div className="min-w-0">
                <label htmlFor="remember-login" className="block cursor-pointer text-sm font-bold">
                  {t("remember_me")}
                </label>
                <small
                  id="remember-login-hint"
                  className="mt-[3px] block text-xs leading-[1.45] text-muted-foreground"
                >
                  {t("remember_login_hint")}
                </small>
              </div>
            </div>
            <Button type="submit" className="h-11 w-full sm:h-10" disabled={isSubmitting}>
              {isSubmitting ? t("loading") : t("login")}
            </Button>
          </form>
          {oidcProviderName !== null && (
            <div className="mt-4 space-y-4 [&>button]:h-auto [&>button]:min-h-11 [&>button]:whitespace-normal [&>button]:py-2.5 [&>button]:break-words sm:[&>button]:min-h-10">
              <div className="flex items-center gap-3">
                <span className="h-px flex-1 bg-border" />
                <span className="text-xs uppercase text-muted-foreground">{t("or")}</span>
                <span className="h-px flex-1 bg-border" />
              </div>
              <OIDCLoginButton providerName={oidcProviderName} remember={remember} />
            </div>
          )}
          {registrationOpen && (
            <p className="mt-4 text-center text-sm text-muted-foreground">
              {t("no_account")}{" "}
              <Link
                to="/register"
                className="inline-flex min-h-11 items-center text-primary sm:min-h-0"
              >
                {t("create_account")}
              </Link>
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
