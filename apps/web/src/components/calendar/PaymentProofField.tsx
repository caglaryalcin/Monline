import { FileText, Upload, X } from "lucide-react";
import { type ClipboardEvent, useId, useRef } from "react";

import { Button } from "@/components/ui/button";

export function pastePaymentProof(event: ClipboardEvent, select: (file: File) => void) {
  const item = Array.from(event.clipboardData.items).find((entry) =>
    entry.type.startsWith("image/"),
  );
  const file = item?.getAsFile();
  if (!file) return;
  event.preventDefault();
  select(
    new File([file], `screenshot-${Date.now()}.${file.type.split("/")[1] || "png"}`, {
      type: file.type,
    }),
  );
}

export function PaymentProofField({
  file,
  onChange,
  t,
}: {
  file: File | null;
  onChange: (file: File | null) => void;
  t: (key: string) => string;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="space-y-2 rounded-xl border border-dashed p-4" tabIndex={0}>
      <Button
        type="button"
        variant="outline"
        onClick={() => input.current?.click()}
        className="gap-2"
      >
        <Upload className="h-4 w-4" />
        {t("upload_proof")}
      </Button>
      <input
        id={id}
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
        className="sr-only"
        onChange={(event) => onChange(event.target.files?.[0] ?? null)}
      />
      {file && (
        <div className="flex min-w-0 items-center gap-2 text-sm">
          <FileText className="h-4 w-4 shrink-0" />
          <span className="min-w-0 flex-1 truncate">{file.name}</span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={t("remove_proof")}
            onClick={() => onChange(null)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}
      <p className="text-xs text-muted-foreground">{t("proof_paste_hint")}</p>
    </div>
  );
}
