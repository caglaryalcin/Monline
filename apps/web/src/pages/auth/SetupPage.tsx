import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Check, Loader2, Mail, ShieldCheck } from "lucide-react";
import { type InputHTMLAttributes, useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { LogoIcon } from "@/components/AppLogo";
import { LanguagePicker } from "@/components/auth/LanguagePicker";
import { Button } from "@/components/ui/button";
import { FeatureToggleCard } from "@/components/ui/FeatureToggleCard";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/contexts/AuthContext";
import { SUPPORTED_LANGUAGES } from "@/lib/languages";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { setupRoute } from "@/routes";
import { authService } from "@/services/auth";
import { setupService } from "@/services/setup";

import { SETUP_CURRENCIES, SETUP_FIELDS, type SetupForm, setupSchema } from "./setup.schema";
import { SetupStart } from "./SetupStart";

const STEPS = ["setup_account", "setup_defaults", "setup_notifications", "setup_review"];

export function SetupPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { user, isAdmin, isLoading, refreshUser } = useAuth();
  const search = setupRoute.useSearch();
  const preview = import.meta.env.DEV && search.preview === true && isAdmin;
  const status = useQuery({
    queryKey: ["setup", "status"],
    queryFn: setupService.status,
    retry: false,
    staleTime: 0,
  });
  const [step, setStep] = useState(0);
  const [startNew, setStartNew] = useState(false);
  const [furthest, setFurthest] = useState(0);
  const [error, setError] = useState("");
  const [smtpTesting, setSmtpTesting] = useState(false);
  const [smtpTestResult, setSmtpTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const {
    register,
    control,
    handleSubmit,
    trigger,
    watch,
    getValues,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<SetupForm>({
    resolver: zodResolver(setupSchema(t)),
    mode: "onTouched",
    defaultValues: {
      username: "",
      email: "",
      password: "",
      passwordConfirm: "",
      language: i18n.resolvedLanguage || "en",
      currency:
        i18n.resolvedLanguage === "tr" ? "TRY" : i18n.resolvedLanguage === "de" ? "EUR" : "USD",
      budget: "0",
      darkThemeMode: "2",
      openRegistrations: false,
      serverUrl: window.location.origin,
      smtpEnabled: false,
      smtpHost: "",
      smtpPort: "587",
      smtpUsername: "",
      smtpPassword: "",
      smtpSenderName: "Monline",
      smtpSenderAddress: "",
      smtpTls: true,
    },
  });
  const values = watch();
  useEffect(() => {
    setSmtpTestResult(null);
  }, [
    values.email,
    values.language,
    values.smtpEnabled,
    values.smtpHost,
    values.smtpPort,
    values.smtpUsername,
    values.smtpPassword,
    values.smtpSenderName,
    values.smtpSenderAddress,
    values.smtpTls,
  ]);

  useEffect(() => {
    if (status.data?.hasUsers && !isLoading && !preview)
      void navigate({ to: user ? "/dashboard" : "/login", replace: true });
  }, [status.data, isLoading, preview, user, navigate]);
  useEffect(() => {
    if (
      i18n.resolvedLanguage &&
      SUPPORTED_LANGUAGES.some((language) => language.code === i18n.resolvedLanguage)
    )
      setValue("language", i18n.resolvedLanguage);
  }, [i18n.resolvedLanguage, setValue]);

  const next = async () => {
    if (!preview && !(await trigger(SETUP_FIELDS[step], { shouldFocus: true }))) return;
    setFurthest((value) => Math.max(value, step + 1));
    setStep((value) => Math.min(3, value + 1));
  };
  const testSmtp = async () => {
    if (preview || smtpTesting || !values.smtpEnabled) return;
    setSmtpTestResult(null);
    if (!(await trigger(["email", "language", ...SETUP_FIELDS[2]], { shouldFocus: true }))) return;
    const data = getValues();
    setSmtpTesting(true);
    try {
      await setupService.testSmtp({
        email: data.email.trim(),
        language: data.language,
        smtp: {
          enabled: true,
          host: data.smtpHost,
          port: Number(data.smtpPort),
          username: data.smtpUsername,
          password: data.smtpPassword,
          senderName: data.smtpSenderName,
          senderAddress: data.smtpSenderAddress.trim(),
          tls: data.smtpTls,
        },
      });
      setSmtpTestResult({ success: true, message: "setup_smtp_test_success" });
    } catch (failure) {
      const key =
        failure instanceof Error &&
        [
          "setup_smtp_test_rate_limit",
          "setup_smtp_test_auth_failed",
          "setup_smtp_test_connection_failed",
          "setup_already_complete",
          "setup_restore_busy",
        ].includes(failure.message)
          ? failure.message
          : "setup_smtp_test_failed";
      setSmtpTestResult({ success: false, message: key });
    } finally {
      setSmtpTesting(false);
    }
  };
  const complete = async (data: SetupForm) => {
    if (preview) return;
    setError("");
    try {
      const session = await setupService.complete({
        username: data.username,
        email: data.email,
        password: data.password,
        passwordConfirm: data.passwordConfirm,
        language: data.language,
        currency: data.currency,
        budget: Number(data.budget),
        darkThemeMode: Number(data.darkThemeMode),
        openRegistrations: data.openRegistrations,
        serverUrl: data.serverUrl,
        smtp: {
          enabled: data.smtpEnabled,
          host: data.smtpHost,
          port: Number(data.smtpPort),
          username: data.smtpUsername,
          password: data.smtpPassword,
          senderName: data.smtpSenderName,
          senderAddress: data.smtpSenderAddress.trim(),
          tls: data.smtpTls,
        },
      });
      authService.saveSession(session.token, session.record);
      await refreshUser();
      toast.success(t("setup_success"));
      void navigate({ to: "/dashboard", replace: true });
    } catch (failure) {
      const key =
        failure instanceof Error &&
        ["setup_already_complete", "setup_restore_busy"].includes(failure.message)
          ? failure.message
          : "setup_failed";
      setError(t(key));
    }
  };
  const input = (
    name: keyof SetupForm,
    label: string,
    options: InputHTMLAttributes<HTMLInputElement> = {},
  ) => (
    <div className="space-y-2" key={name}>
      <Label htmlFor={`setup-${name}`} className="text-xs font-medium text-muted-foreground">
        {label}
      </Label>
      <Input
        id={`setup-${name}`}
        {...options}
        {...register(name)}
        aria-invalid={!!errors[name]}
        aria-describedby={errors[name] ? `setup-${name}-error` : undefined}
        className="rounded-xl bg-background"
      />
      {errors[name] && (
        <p id={`setup-${name}-error`} role="alert" className="text-xs text-destructive">
          {errors[name]?.message}
        </p>
      )}
    </div>
  );
  const select = (
    name: "currency" | "darkThemeMode",
    label: string,
    options: { value: string; label: string }[],
  ) => (
    <div className="space-y-2">
      <Label htmlFor={`setup-${name}`} className="text-xs font-medium text-muted-foreground">
        {label}
      </Label>
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <Select value={field.value} onValueChange={field.onChange}>
            <SelectTrigger
              id={`setup-${name}`}
              onBlur={field.onBlur}
              ref={field.ref}
              aria-invalid={!!errors[name]}
              className="rounded-xl"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      />
      {errors[name] && (
        <p role="alert" className="text-xs text-destructive">
          {errors[name]?.message}
        </p>
      )}
    </div>
  );

  if (status.isPending || isLoading)
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" aria-label={t("loading")} />
      </div>
    );
  if (status.isError)
    return (
      <div className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-4 p-6">
        <p role="alert">{t("setup_status_failed")}</p>
        <Button onClick={() => void status.refetch()}>{t("statement_import_retry")}</Button>
      </div>
    );
  if (status.data?.hasUsers && !preview) return null;

  return (
    <div className="min-h-screen bg-background p-3 sm:p-6 lg:p-10">
      <div className="mx-auto max-w-6xl overflow-hidden rounded-3xl border bg-card">
        <header className="flex flex-wrap items-center justify-between gap-5 border-b px-6 py-6 sm:px-8">
          <div className="flex items-start gap-4">
            <LogoIcon className="mt-0.5 h-9 w-9" />
            <div>
              <h1 className="text-xl font-bold tracking-tight">{t("setup_welcome")}</h1>
              <p className="mt-1 text-sm text-muted-foreground">{t("setup_description")}</p>
            </div>
          </div>
          <LanguagePicker />
        </header>
        {preview && (
          <p role="status" className="border-b bg-muted/30 px-6 py-3 text-sm text-muted-foreground">
            {t("setup_preview")}
          </p>
        )}
        {!startNew ? (
          <SetupStart preview={preview} onNew={() => setStartNew(true)} />
        ) : (
          <div className="grid min-h-[600px] md:grid-cols-[244px_minmax(0,1fr)]">
            <nav
              className="border-b bg-muted/10 p-4 md:border-b-0 md:border-r"
              aria-label={t("setup_steps")}
            >
              <ol className="grid gap-2 sm:grid-cols-2 md:grid-cols-1">
                {STEPS.map((key, index) => (
                  <li key={key}>
                    <button
                      type="button"
                      disabled={isSubmitting || smtpTesting || (!preview && index > furthest)}
                      onClick={() => setStep(index)}
                      aria-current={step === index ? "step" : undefined}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-xl border px-3 py-3.5 text-left text-sm font-semibold focus-visible:outline focus-visible:outline-ring disabled:cursor-default",
                        step === index
                          ? "border-border bg-muted text-foreground"
                          : "border-transparent text-muted-foreground",
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs",
                          step === index || index < furthest
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground",
                        )}
                      >
                        {index < step ? <Check className="h-3.5 w-3.5" /> : index + 1}
                      </span>
                      {t(key)}
                    </button>
                  </li>
                ))}
              </ol>
            </nav>
            <form
              noValidate
              className="min-w-0 p-6 sm:p-8"
              onSubmit={(event) => {
                if (step < 3) {
                  event.preventDefault();
                  void next();
                } else
                  void handleSubmit(complete, (invalid) => {
                    const index = SETUP_FIELDS.findIndex((fields) =>
                      fields.some((field) => invalid[field]),
                    );
                    if (index >= 0) setStep(index);
                  })(event);
              }}
            >
              <fieldset disabled={isSubmitting || smtpTesting} className="space-y-7">
                <div>
                  <h2 className="text-lg font-semibold">{t(STEPS[step])}</h2>
                  {step === 0 ? (
                    <div className="mt-3 flex items-start gap-3 rounded-xl border border-primary/30 bg-primary/5 p-3">
                      <ShieldCheck
                        className="mt-0.5 h-5 w-5 shrink-0 text-primary"
                        aria-hidden="true"
                      />
                      <p className="text-sm leading-relaxed text-muted-foreground">
                        {t("setup_account_description")}
                      </p>
                    </div>
                  ) : (
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                      {t(STEPS[step] + "_description")}
                    </p>
                  )}
                </div>
                {step === 0 && (
                  <div className="grid gap-5 sm:grid-cols-2">
                    {input("username", t("username"), { autoComplete: "username", maxLength: 50 })}
                    {input("email", t("email"), {
                      type: "email",
                      autoComplete: "email",
                      maxLength: 254,
                    })}
                    {input("password", t("password"), {
                      type: "password",
                      autoComplete: "new-password",
                    })}
                    {input("passwordConfirm", t("confirm_password"), {
                      type: "password",
                      autoComplete: "new-password",
                    })}
                  </div>
                )}
                {step === 1 && (
                  <div className="space-y-5">
                    <div className="grid gap-5 sm:grid-cols-2">
                      {select(
                        "currency",
                        t("main_currency"),
                        SETUP_CURRENCIES.map((code) => ({ value: code, label: code })),
                      )}
                      {input("budget", t("budget_this_month"), {
                        type: "number",
                        min: 0,
                        step: "0.01",
                        inputMode: "decimal",
                      })}
                      {select("darkThemeMode", t("theme"), [
                        { value: "2", label: t("setup_system_theme") },
                        { value: "0", label: t("light") },
                        { value: "1", label: t("dark") },
                      ])}
                    </div>
                    {input("serverUrl", t("server_url"), { type: "url", autoComplete: "url" })}
                    <div className="flex items-center justify-between gap-4 rounded-xl border p-4">
                      <div>
                        <Label htmlFor="setup-registrations">{t("open_registrations")}</Label>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {t("open_registrations_desc")}
                        </p>
                      </div>
                      <Switch
                        id="setup-registrations"
                        checked={values.openRegistrations}
                        onCheckedChange={(value) => setValue("openRegistrations", value)}
                      />
                    </div>
                  </div>
                )}
                {step === 2 && (
                  <div className="space-y-5">
                    <FeatureToggleCard
                      enabled={values.smtpEnabled}
                      onEnabledChange={(value) => {
                        setValue("smtpEnabled", value);
                        if (value && !getValues("smtpSenderAddress"))
                          setValue("smtpSenderAddress", getValues("email"));
                      }}
                      description={t("setup_smtp_optional")}
                    />
                    {values.smtpEnabled && (
                      <>
                        <div className="grid gap-5 sm:grid-cols-2">
                          {input("smtpHost", t("smtp_address"), { autoComplete: "off" })}
                          {input("smtpPort", t("smtp_port"), {
                            type: "number",
                            min: 1,
                            max: 65535,
                          })}
                          {input("smtpUsername", t("username"), { autoComplete: "off" })}
                          {input("smtpPassword", t("password"), {
                            type: "password",
                            autoComplete: "off",
                          })}
                          {input("smtpSenderName", t("smtp_from_name"))}
                          {input("smtpSenderAddress", t("smtp_from_email"), { type: "email" })}
                        </div>
                        <div className="flex items-center justify-between rounded-xl border p-4">
                          <Label htmlFor="setup-tls">TLS</Label>
                          <Switch
                            id="setup-tls"
                            checked={values.smtpTls}
                            onCheckedChange={(value) => setValue("smtpTls", value)}
                          />
                        </div>
                        <div className="space-y-3">
                          <p className="text-xs text-muted-foreground">
                            {t("setup_smtp_test_recipient", { email: values.email })}
                          </p>
                          <Button
                            type="button"
                            variant="outline"
                            className="rounded-xl"
                            disabled={smtpTesting || preview}
                            onClick={() => void testSmtp()}
                          >
                            {smtpTesting ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <Mail className="mr-2 h-4 w-4" />
                            )}
                            {t(smtpTesting ? "sending" : "send_test_email")}
                          </Button>
                          {smtpTestResult && (
                            <p
                              role={smtpTestResult.success ? "status" : "alert"}
                              className={cn(
                                "rounded-xl border px-4 py-3 text-sm",
                                smtpTestResult.success
                                  ? "border-primary/30 text-primary"
                                  : "border-destructive/30 text-destructive",
                              )}
                            >
                              {t(smtpTestResult.message)}
                            </p>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )}
                {step === 3 && (
                  <dl className="divide-y rounded-2xl border px-5">
                    {[
                      [t("account_type"), t("setup_account")],
                      [t("username"), values.username],
                      [t("email"), values.email],
                      [t("main_currency"), values.currency],
                      [t("budget_this_month"), `${values.budget} ${values.currency}`],
                      [
                        t("language"),
                        SUPPORTED_LANGUAGES.find((language) => language.code === values.language)
                          ?.name,
                      ],
                      [t("server_url"), values.serverUrl],
                      [
                        t("open_registrations"),
                        t(values.openRegistrations ? "enabled" : "disabled"),
                      ],
                      ["SMTP", t(values.smtpEnabled ? "enabled" : "disabled")],
                      [t("setup_accent"), "Monline"],
                    ].map(([label, value]) => (
                      <div
                        key={label}
                        className="flex flex-wrap justify-between gap-3 py-3 text-sm"
                      >
                        <dt className="text-muted-foreground">{label}</dt>
                        <dd className="min-w-0 break-all font-medium">{value || "—"}</dd>
                      </div>
                    ))}
                  </dl>
                )}
                {error && (
                  <div
                    role="alert"
                    className="space-y-2 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"
                  >
                    <p>{error}</p>
                    <Link to="/login" className="underline">
                      {t("setup_back_to_login")}
                    </Link>
                  </div>
                )}
                <div className="flex items-center justify-between gap-4 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isSubmitting}
                    onClick={() => {
                      if (step === 0) setStartNew(false);
                      else setStep((value) => value - 1);
                    }}
                    className="rounded-xl"
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    {t("back")}
                  </Button>
                  {step < 3 ? (
                    <Button type="submit" className="rounded-xl">
                      {t("next")}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  ) : (
                    <Button type="submit" disabled={isSubmitting || preview} className="rounded-xl">
                      {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {t(isSubmitting ? "setup_creating" : "setup_finish")}
                    </Button>
                  )}
                </div>
              </fieldset>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
