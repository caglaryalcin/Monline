import { FileSearch, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { detectStatement, type StatementBank } from "@/lib/statements";

import { detectStatementCard, type StatementCardDetails } from "../../../../backend/src/domain/lib/pure/statement-card.mjs";

export function StatementCardReader({ disabled, onRead, onBusyChange }: {
  disabled: boolean;
  onBusyChange: (busy: boolean) => void;
  onRead: (result: { bank: StatementBank | ""; fileHash: string; details: StatementCardDetails }) => Promise<void>;
}) {
  const { t } = useTranslation();
  const input = useRef<HTMLInputElement>(null);
  const controller = useRef<AbortController | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  useEffect(() => () => { controller.current?.abort(); onBusyChange(false); }, [onBusyChange]);
  async function read(selected: File) {
    controller.current?.abort();
    const aborter = new AbortController(); controller.current = aborter;
    setFile(selected); setBusy(true); setError(""); setNotice("");
    onBusyChange(true);
    try {
      const { readStatementPdf } = await import("@/lib/statementPdf");
      if (aborter.signal.aborted) return;
      const pdf = await readStatementPdf(selected, password, (page, total) => {
        if (!aborter.signal.aborted) setProgress(t("statement_progress", { current: page, total }));
      }, aborter.signal);
      if (aborter.signal.aborted) return;
      const details = detectStatementCard(pdf.lines);
      await onRead({ bank: detectStatement(pdf.lines).bank, fileHash: pdf.fileHash, details });
      if (aborter.signal.aborted) return;
      setPassword(""); setFile(null);
      setNotice(t(details.candidates?.length ? "credit_cards_detect_multiple" : details.last_four ? "credit_cards_detected" : "credit_cards_not_detected"));
    } catch (err) {
      if (aborter.signal.aborted) return;
      setError(t(err instanceof Error && err.name === "PasswordException" ? "statement_password_error" :
        err instanceof Error && /^(statement_|credit_cards_)/.test(err.message) ? err.message : "statement_read_failed"));
    } finally {
      if (!aborter.signal.aborted) { setBusy(false); setProgress(""); onBusyChange(false); }
    }
  }
  return <div className="space-y-3 rounded-2xl border bg-muted/20 p-4">
    <p className="text-sm text-muted-foreground">{t("credit_cards_read_pdf_help")}</p>
    <label className="grid gap-2 text-sm font-medium">{t("statement_password")}
      <Input type="password" value={password} autoComplete="off" disabled={disabled || busy} onChange={event => setPassword(event.target.value)} />
    </label>
    <input ref={input} type="file" accept=".pdf,application/pdf" aria-label={t("credit_cards_read_pdf")} className="hidden" disabled={disabled || busy} onChange={event => {
      const selected = event.target.files?.[0]; event.target.value = "";
      if (selected) void read(selected);
    }} />
    <div className="flex flex-wrap gap-2">
      <Button type="button" variant="outline" className="gap-2 rounded-xl" disabled={disabled || busy} onClick={() => input.current?.click()}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSearch className="h-4 w-4" />}{t("credit_cards_read_pdf")}
      </Button>
      {file && !busy && <Button type="button" variant="outline" disabled={disabled} onClick={() => void read(file)}>{t("statement_import_retry")}</Button>}
    </div>
    {(busy || notice) && <p role="status" className="text-sm text-muted-foreground">{progress || (busy ? t("loading") : notice)}</p>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </div>;
}
