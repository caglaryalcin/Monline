import { Camera, ShieldCheck } from "lucide-react";
import type { MutableRefObject } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";

interface ProfileAvatarCardProps {
  displayName: string;
  email?: string | null;
  fileRef: MutableRefObject<HTMLInputElement | null>;
  preview: string | null;
  onFileChange: (file: File) => void;
  isAdmin?: boolean;
}

export function ProfileAvatarCard({
  displayName,
  email,
  fileRef,
  preview,
  onFileChange,
  isAdmin = false,
}: ProfileAvatarCardProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col sm:flex-row gap-6 items-center sm:items-start p-6 rounded-2xl border bg-card/50 shadow-sm">
      <div className="relative group shrink-0">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          aria-label={t("change_avatar")}
          className="h-24 w-24 rounded-full overflow-hidden border-4 border-background shadow-lg transition-transform "
        >
          {preview ? (
            <img src={preview} alt={displayName} className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full bg-primary/10 flex items-center justify-center text-3xl font-bold text-primary">
              {displayName[0]?.toUpperCase()}
            </div>
          )}
        </button>
        <button
          type="button"
          aria-label={t("change_avatar")}
          onClick={() => fileRef.current?.click()}
          className="absolute -bottom-2 -right-2 p-2.5 bg-primary text-primary-foreground rounded-full shadow-md scale-100 transition-transform duration-200"
        >
          <Camera className="w-4 h-4" />
        </button>
        <input
          ref={(node) => {
            fileRef.current = node;
          }}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && onFileChange(e.target.files[0])}
        />
      </div>

      <div className="text-center sm:text-left space-y-2 flex-1 pt-2">
        <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
          <h3 className="font-semibold text-xl">{displayName}</h3>
          {isAdmin && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              {t("admin")}
            </span>
          )}
        </div>
        <p className="text-sm text-muted-foreground">{email}</p>
        {isAdmin && (
          <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
            {t("admin_account_description")}
          </p>
        )}
        <Button
          variant="outline"
          size="sm"
          className="mt-4 rounded-xl"
          type="button"
          onClick={() => fileRef.current?.click()}
        >
          {t("change_avatar")}
        </Button>
      </div>
    </div>
  );
}
