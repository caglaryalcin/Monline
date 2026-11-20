import { Cpu, CreditCard as CreditCardIcon, FilePlus2, Loader2, Nfc, Pencil, Plus, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import { StatementBankLogo } from "@/components/StatementBankLogo";
import { Button } from "@/components/ui/button";
import { useLocalToday } from "@/hooks/useLocalToday";
import { cardBankName, type CreditCard, type CreditCardInput, type CreditCardsData, supportedCardBank } from "@/lib/creditCards";
import { cn } from "@/lib/utils";

export function CreditCardFace({ card }: { card: CreditCardInput }) {
  const { t } = useTranslation();
  return <span className="mx-auto flex aspect-[85.6/53.98] w-full max-w-[360px] min-w-0 flex-col justify-between overflow-hidden rounded-2xl bg-gradient-to-br from-primary/15 via-muted/70 to-background p-3 text-left text-foreground sm:p-4">
    <span className="flex min-w-0 items-center justify-between gap-3">
      <StatementBankLogo bank={supportedCardBank(card.bank)} className="h-8 w-[72px] rounded-lg p-1.5" />
      <span className="sr-only">{cardBankName(card.bank) || t("credit_cards_bank")}</span>
    </span>
    <span className="flex min-w-0 flex-col gap-2">
    <span aria-hidden="true" className="flex items-center gap-2 text-muted-foreground">
      <span className="rounded-md border border-primary/20 bg-primary/10 p-1"><Cpu className="h-5 w-6" /></span>
      <Nfc className="h-4 w-4" />
    </span>
    <span className="whitespace-nowrap font-mono text-base tracking-wide">•••• •••• •••• {card.last_four || "••••"}</span>
    </span>
    <span className="flex min-w-0 items-end justify-between gap-3 text-xs">
      <span className="min-w-0 flex-1 truncate">{card.name || t("credit_cards_title")}</span>
      <span className="shrink-0 text-right"><span className="block text-[10px] tracking-wider text-muted-foreground">{t("credit_cards_valid_thru")}</span>
        <span className="font-mono">{card.expiry ? `${card.expiry.slice(5)}/${card.expiry.slice(2, 4)}` : "••/••"}</span>
      </span>
      {(card.network === "visa" || card.network === "mastercard") && <img
        src={`/assets/payments/${card.network === "visa" ? "Visa" : "Mastercard"}.png`}
        alt={card.network === "visa" ? "Visa" : "Mastercard"} width={70} height={48}
        className="h-8 w-12 shrink-0 rounded object-contain" draggable={false} />}
    </span>
  </span>;
}

export function CreditCardGallery({ data, loading, failed, selected, disabled, onSelect, onAdd, onFromArchive, onEdit, onDelete, onRetry }: {
  data?: CreditCardsData;
  loading: boolean;
  failed: boolean;
  selected: string;
  disabled: boolean;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onFromArchive: () => void;
  onEdit: (card: CreditCard) => void;
  onDelete: (card: CreditCard) => void;
  onRetry: () => void;
}) {
  const { t } = useTranslation();
  const today = useLocalToday();
  return <section className="space-y-5" aria-label={t("credit_cards_title")}>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h1 className="text-2xl font-semibold tracking-tight">{t("credit_cards_title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("credit_cards_intro")}</p></div>
      <div className="flex flex-wrap gap-2">
        {!!data?.unassigned_count && <Button variant="outline" className="gap-2 rounded-xl" disabled={disabled} onClick={onFromArchive}>
          <FilePlus2 className="h-4 w-4" />{t("credit_cards_from_archive")}
        </Button>}
        <Button className="gap-2 rounded-xl" disabled={disabled || loading || failed} onClick={onAdd}><Plus className="h-4 w-4" />{t("credit_cards_add")}</Button>
      </div>
    </div>
    {loading ? <Loader2 className="h-5 w-5 animate-spin" aria-label={t("loading")} /> : failed ?
      <div role="alert" className="flex flex-wrap items-center gap-3 text-sm text-destructive"><p>{t("credit_cards_load_failed")}</p><Button variant="outline" onClick={onRetry}>{t("statement_import_retry")}</Button></div> :
      !data?.cards.length ? <div className="rounded-2xl border border-dashed p-8 text-center">
        <CreditCardIcon aria-hidden="true" className="mx-auto mb-3 h-8 w-8 text-primary" />
        <p className="font-medium">{t("credit_cards_empty")}</p><p className="mt-1 text-sm text-muted-foreground">{t("credit_cards_empty_help")}</p>
      </div> : <div className="flex flex-wrap gap-5">
        {data.cards.map(card => <div key={card.id} className="w-full min-w-0 max-w-[340px] space-y-2">
          <button type="button" aria-pressed={selected === card.id} disabled={disabled} onClick={() => onSelect(card.id)}
            className={cn("block w-full overflow-hidden rounded-2xl border text-left transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60", selected === card.id ? "border-primary ring-2 ring-inset ring-primary/60" : "border-border hover:ring-2 hover:ring-inset hover:ring-primary/30")}>
            <CreditCardFace card={card} />
          </button>
          <div className="flex flex-wrap items-center justify-between gap-1 px-1 text-xs text-muted-foreground">
            <span>{t("credit_cards_count", { count: card.statement_count })}{card.expiry < today.slice(0, 7) && <span className="ml-2 text-destructive">{t("credit_cards_expired")}</span>}
              {!!card.statement_day && <span className="mt-1 block">{t("credit_cards_statement_day_value", { day: card.statement_day })}</span>}
            </span>
            <div className="flex gap-1"><Button size="icon" variant="ghost" className="h-8 w-8" aria-label={`${t("credit_cards_edit")}: ${cardBankName(card.bank)} ${card.last_four}`} disabled={disabled} onClick={() => onEdit(card)}><Pencil className="h-3.5 w-3.5" /></Button>
              <Button size="icon" variant="ghost" className="h-8 w-8" aria-label={`${t("credit_cards_delete")}: ${cardBankName(card.bank)} ${card.last_four}`} disabled={disabled} onClick={() => onDelete(card)}><Trash2 className="h-3.5 w-3.5" /></Button></div>
          </div>
        </div>)}
      </div>}
    {disabled && <p className="text-sm text-muted-foreground">{t("credit_cards_finish_review")}</p>}
    {!!data && <div className="flex flex-wrap gap-2 border-b pb-4">
      <Button variant={selected === "all" ? "secondary" : "ghost"} aria-pressed={selected === "all"} className="gap-2 rounded-xl" disabled={disabled} onClick={() => onSelect("all")}>{t("credit_cards_all")}<span className="text-xs text-muted-foreground">{data.total_count}</span></Button>
      <Button variant={selected === "unassigned" ? "secondary" : "ghost"} aria-pressed={selected === "unassigned"} className="gap-2 rounded-xl" disabled={disabled} onClick={() => onSelect("unassigned")}>{t("credit_cards_unassigned")}<span className="text-xs text-muted-foreground">{data.unassigned_count}</span></Button>
    </div>}
  </section>;
}
