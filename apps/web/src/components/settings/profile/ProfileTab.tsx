import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { Save } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { Controller } from "react-hook-form";
import { useTranslation } from "react-i18next";

import {
  buildProfileSchema,
  type ProfileFormValues,
} from "@/components/settings/profile/profile.schema";
import { ProfileAvatarCard } from "@/components/settings/profile/ProfileAvatarCard";
import { ProfileBudgetCard } from "@/components/settings/profile/ProfileBudgetCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/contexts/AuthContext";
import { SUPPORTED_LANGUAGES } from "@/lib/i18n";
import i18n from "@/lib/i18n";
import { compressImage } from "@/lib/image";
import { queryKeys } from "@/lib/queryKeys";
import { toast } from "@/lib/toast";
import { currenciesService } from "@/services/currencies";
import { usersService } from "@/services/users";
import type { Currency } from "@/types";

export function ProfileTab() {
  const { t } = useTranslation();
  const { user, refreshUser, isAdmin } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [budget, setBudget] = useState<number>(user?.budget ?? 0);

  const { data: mainCurrency } = useQuery<Currency | undefined>({
    queryKey: queryKeys.mainCurrency(user?.id ?? ""),
    queryFn: async () => {
      const list = await currenciesService.listMain(user!.id);
      return list[0];
    },
    enabled: !!user?.id,
  });

  // Preserve unsaved edits when unrelated user settings refresh.
  useEffect(() => {
    setBudget(user?.budget ?? 0);
  }, [user?.id, user?.budget]);

  const savedAvatarUrl = user ? usersService.avatarUrl(user) : null;
  useEffect(() => {
    if (!avatarFile) setPreview(savedAvatarUrl || null);
  }, [savedAvatarUrl, avatarFile]);

  useEffect(
    () => () => {
      if (preview?.startsWith("blob:")) URL.revokeObjectURL(preview);
    },
    [preview],
  );

  const schema = buildProfileSchema(t);

  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      username: user?.name || user?.username || "",
      email: user?.email ?? "",
      oldPwd: "",
      language: user?.language || i18n.resolvedLanguage || "en",
    },
  });

  const emailChanged =
    watch("email").trim().toLowerCase() !== (user?.email ?? "").trim().toLowerCase();

  const onSubmit = async (data: ProfileFormValues) => {
    if (!user) return;
    if (emailChanged && !data.oldPwd) {
      setError("oldPwd", { type: "required", message: t("required") });
      return;
    }
    try {
      const fd = new FormData();
      fd.set("name", data.username);
      fd.set("email", data.email);
      fd.set("language", data.language);
      fd.set("budget", String(budget || 0));
      if (emailChanged) fd.set("oldPassword", data.oldPwd);
      if (avatarFile) fd.set("avatar", avatarFile);
      await usersService.update(user!.id, fd);
      i18n.changeLanguage(data.language);
      await refreshUser();
      setAvatarFile(null);
      toast.success(t("saved"));
      reset({ ...data, oldPwd: "" });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  const handleAvatar = async (f: File) => {
    const compressed = await compressImage(f, { maxSize: 512 });
    setAvatarFile(compressed);
    setPreview(URL.createObjectURL(compressed));
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <form onSubmit={handleSubmit(onSubmit)} className="relative space-y-8 pb-20">
        <div className="space-y-8">
          <ProfileAvatarCard
            isAdmin={isAdmin}
            displayName={user?.name || user?.username || t("user")}
            email={user?.email}
            fileRef={fileRef}
            preview={preview}
            onFileChange={handleAvatar}
          />

          <div className="space-y-4">
            <h3 className="font-semibold text-lg">{t("basic_information")}</h3>
            <div className="grid gap-2">
              <Label htmlFor="profile-name">{t("username")}</Label>
              <Input
                id="profile-name"
                autoComplete="name"
                {...register("username")}
                placeholder={t("your_name_placeholder")}
                className="rounded-xl"
              />
              {errors.username && (
                <p className="text-sm text-destructive">{errors.username.message}</p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="profile-email">{t("email")}</Label>
              <Input
                id="profile-email"
                autoComplete="email"
                type="email"
                {...register("email")}
                placeholder="your.email@example.com"
                className="rounded-xl"
              />
              {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
            </div>
            {emailChanged && (
              <div className="grid gap-2">
                <Label htmlFor="profile-email-password">{t("old_password")}</Label>
                <Input
                  id="profile-email-password"
                  type="password"
                  autoComplete="current-password"
                  aria-invalid={!!errors.oldPwd}
                  aria-describedby="profile-email-password-hint"
                  {...register("oldPwd")}
                  className="rounded-xl"
                />
                <p id="profile-email-password-hint" className="text-sm text-muted-foreground">
                  {t("email_change_password_hint")}
                </p>
                {errors.oldPwd && (
                  <p role="alert" className="text-sm text-destructive">
                    {errors.oldPwd.message}
                  </p>
                )}
              </div>
            )}
          </div>

          <Separator />

          <ProfileBudgetCard
            budget={budget}
            onBudgetChange={setBudget}
            symbol={mainCurrency?.symbol}
            code={mainCurrency?.code}
          />

          <Separator />

          <div className="space-y-4">
            <h3 className="font-semibold text-lg">{t("preferences")}</h3>
            <div className="grid gap-2">
              <Label htmlFor="profile-language">{t("language")}</Label>
              <Controller
                name="language"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="profile-language" className="rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SUPPORTED_LANGUAGES.map((l) => (
                        <SelectItem key={l.code} value={l.code}>
                          {l.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-card via-card to-transparent flex justify-end">
          <Button
            type="submit"
            size="lg"
            disabled={isSubmitting}
            className="shadow-lg shadow-primary/20 transition-all rounded-xl px-8"
          >
            <Save className="w-4 h-4 mr-2" />
            {t("save")}
          </Button>
        </div>
      </form>
    </div>
  );
}
