import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { CreditCardFace } from "@/components/credit-cards/CreditCardGallery";
import { StatementCardReader } from "@/components/credit-cards/StatementCardReader";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ThemedSelect } from "@/components/ui/themed-select";
import { cardBankName, type CardStatement, type CreditCard, creditCardLabel, supportedCardBank, unassignedStatementsKey } from "@/lib/creditCards";
import { STATEMENT_BANKS } from "@/lib/statements";
import { creditCardsService } from "@/services/creditCards";

function errorKey(error: Error, fallback: string) {
  return error.message.startsWith("credit_cards_") ? error.message : fallback;
}
function expiryInput(value: string) {
  return /^20\d{2}-(0[1-9]|1[0-2])$/.test(value) ? `${value.slice(5)}/${value.slice(2, 4)}` : "";
}
function StatementChoices({ statements, selected, onChange }: { statements: CardStatement[]; selected: string[]; onChange: (ids: string[]) => void }) {
  const { t, i18n } = useTranslation();
  return <fieldset className="min-w-0 space-y-3">
    <legend className="text-sm font-medium">{t("credit_cards_select_statements")}</legend>
    <p className="text-xs text-muted-foreground">{t("credit_cards_select_help")}</p>
    {!statements.length ? <p className="text-sm text-muted-foreground">{t("credit_cards_no_unassigned")}</p> :
      <div className="max-h-56 space-y-2 overflow-y-auto rounded-xl border p-3">
        {statements.map(statement => <label key={statement.id} className="flex cursor-pointer items-start gap-3 rounded-lg p-2 hover:bg-muted/50">
          <input type="checkbox" checked={selected.includes(statement.id)} className="mt-1 h-4 w-4 shrink-0 accent-primary" onChange={event => onChange(event.target.checked ? [...selected, statement.id] : selected.filter(id => id !== statement.id))} />
          <span className="min-w-0 text-sm"><span className="block font-medium">{new Intl.DateTimeFormat(i18n.language.replace("_", "-"), { month: "long", year: "numeric" }).format(new Date(`${statement.period}-15T12:00:00`))}</span>
            <span className="block break-all text-xs text-muted-foreground">{statement.file_name}</span></span>
        </label>)}
      </div>}
    <p className="text-xs text-muted-foreground" aria-live="polite">{t("credit_cards_selected", { count: selected.length })}</p>
  </fieldset>;
}

export function CreditCardEditorDialog({ userId, card, fromArchive = false, source, onClose, onSaved }: {
  userId: string; card?: CreditCard; fromArchive?: boolean; source?: CardStatement;
  onClose: () => void; onSaved: (id: string) => Promise<void>;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const archiveMode = fromArchive || !!source;
  const [bank, setBank] = useState(card?.bank || source?.bank || "");
  const [name, setName] = useState(card?.name || "");
  const [network, setNetwork] = useState<NonNullable<CreditCard["network"]>>(card?.network || "");
  const [lastFour, setLastFour] = useState(card?.last_four || source?.card_details?.last_four || "");
  const [expiry, setExpiry] = useState(expiryInput(card?.expiry || source?.card_details?.expiry || ""));
  const [statementDay, setStatementDay] = useState(card?.statement_day ? String(card.statement_day) : "");
  const [adjustWeekend, setAdjustWeekend] = useState(!!card?.statement_weekend_adjust);
  const [candidates, setCandidates] = useState<string[]>(source?.card_details?.candidates || []);
  const [reading, setReading] = useState(false);
  const [sourceId, setSourceId] = useState(source?.id || "");
  const [selected, setSelected] = useState<string[]>(source ? [source.id] : []);
  const unassigned = useQuery({ queryKey: unassignedStatementsKey(userId), queryFn: creditCardsService.unassigned, enabled: archiveMode });
  const statements = unassigned.data ?? (source ? [source] : []);
  const currentSource = statements.find(statement => statement.id === sourceId) || (source?.id === sourceId ? source : undefined);
  const sourceDetails = useQuery({
    queryKey: ["bank-statements", userId, "card-details", sourceId],
    queryFn: () => creditCardsService.sourceDetails(sourceId),
    enabled: archiveMode && !!sourceId,
  });
  useEffect(() => {
    if (!sourceDetails.data) return;
    const details = sourceDetails.data;
    setLastFour(value => value || details.last_four || "");
    setExpiry(value => value || expiryInput(details.expiry || ""));
    setCandidates(details.candidates || []);
  }, [sourceDetails.data, sourceId]);
  const matching = statements.filter(statement => statement.bank === supportedCardBank(bank));
  const validExpiry = /^(0[1-9]|1[0-2])\/\d{2}$/.test(expiry);
  const values = { bank: supportedCardBank(bank) || bank.trim(), name, last_four: lastFour,
    expiry: validExpiry ? `20${expiry.slice(3)}-${expiry.slice(0, 2)}` : "",
    statement_day: statementDay ? Number(statementDay) : 0, statement_weekend_adjust: adjustWeekend, network };
  const save = useMutation({
    mutationFn: () => card ? creditCardsService.update(card.id, values) : creditCardsService.create(values, archiveMode ? selected : []),
    onSuccess: saved => onSaved(saved.id),
  });
  const submit = (event: FormEvent) => { event.preventDefault(); if (!save.isPending && !reading && validExpiry) save.mutate(); };
  return <Dialog open onOpenChange={open => { if (!open && !save.isPending) onClose(); }}>
    <DialogContent className="max-h-[90dvh] overflow-y-auto rounded-3xl sm:max-w-xl" onInteractOutside={event => { if (save.isPending) event.preventDefault(); }}>
      <DialogHeader><DialogTitle>{t(card ? "credit_cards_edit" : archiveMode ? "credit_cards_create_title" : "credit_cards_add")}</DialogTitle><DialogDescription>{t("credit_cards_form_help")}</DialogDescription></DialogHeader>
      <form className="min-w-0 space-y-5" onSubmit={submit}>
        {archiveMode && <label className="grid gap-2 text-sm font-medium">{t("credit_cards_source")}
          <ThemedSelect value={sourceId} disabled={save.isPending || reading || unassigned.isPending || unassigned.isError} onChange={event => {
            const statement = statements.find(item => item.id === event.target.value);
            setSourceId(statement?.id || ""); setBank(statement?.bank || ""); setSelected(statement ? [statement.id] : []);
            setLastFour(statement?.card_details?.last_four || ""); setExpiry(expiryInput(statement?.card_details?.expiry || "")); setCandidates(statement?.card_details?.candidates || []); save.reset();
          }}><option value="">{t("credit_cards_choose_source")}</option>{statements.map(statement => <option key={statement.id} value={statement.id}>{cardBankName(statement.bank)} · {statement.period} · {statement.file_name}</option>)}</ThemedSelect>
        </label>}
        {!card && <>
          {archiveMode && sourceId && <p role="status" className="text-sm text-muted-foreground">{t(sourceDetails.isPending ? "loading" : sourceDetails.isError ? "statement_load_failed" : sourceDetails.data?.last_four ? "credit_cards_detected" : sourceDetails.data?.candidates?.length ? "credit_cards_detect_multiple" : "credit_cards_legacy_pdf")}</p>}
          <StatementCardReader key={sourceId || "new"} onBusyChange={setReading} disabled={save.isPending || (archiveMode && !currentSource)} onRead={async result => {
            if (currentSource && result.fileHash !== currentSource.file_hash) throw new Error("credit_cards_source_pdf_mismatch");
            if (currentSource && result.bank && result.bank !== currentSource.bank) throw new Error("credit_cards_bank_mismatch");
            if (currentSource) {
              await creditCardsService.saveDetails(currentSource.id, result.fileHash, result.details);
              queryClient.setQueryData(["bank-statements", userId, "card-details", sourceId], result.details);
              await queryClient.invalidateQueries({ queryKey: unassignedStatementsKey(userId) });
            } else if (result.bank) setBank(result.bank);
            setLastFour(result.details.last_four || ""); setExpiry(expiryInput(result.details.expiry || "")); setCandidates(result.details.candidates || []);
          }} />
          {!!candidates.length && <label className="grid gap-2 text-sm font-medium">{t("credit_cards_detect_choose")}<ThemedSelect value={lastFour} disabled={save.isPending} onChange={event => setLastFour(event.target.value)}>
            <option value="">{t("credit_cards_choose")}</option>{candidates.map(suffix => <option key={suffix} value={suffix}>•••• {suffix}</option>)}
          </ThemedSelect></label>}
        </>}
        <label className="grid gap-2 text-sm font-medium">{t("credit_cards_bank")}
          <Input value={cardBankName(bank)} onChange={event => { setBank(event.target.value); save.reset(); }} placeholder={t("credit_cards_bank_placeholder")} list="credit-card-bank-options" maxLength={80} required disabled={save.isPending || archiveMode || !!card?.statement_count} />
          <datalist id="credit-card-bank-options">{Object.values(STATEMENT_BANKS).map(label => <option key={label} value={label} />)}</datalist>
        </label>
        <label className="grid gap-2 text-sm font-medium">{t("credit_cards_name")}<Input value={name} onChange={event => setName(event.target.value)} placeholder={t("credit_cards_name_placeholder")} maxLength={80} disabled={save.isPending} /></label>
        <label className="grid gap-2 text-sm font-medium">{t("credit_cards_network")}
          <ThemedSelect value={network} disabled={save.isPending} onChange={event => {
            const next = event.target.value;
            if (next === "" || next === "visa" || next === "mastercard") setNetwork(next);
          }}>
            <option value="">{t("credit_cards_network_none")}</option>
            <option value="visa">Visa</option><option value="mastercard">Mastercard</option>
          </ThemedSelect>
        </label>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="grid gap-2 text-sm font-medium">{t("credit_cards_last_four")}<Input value={lastFour} onChange={event => setLastFour(event.target.value.replace(/\D/g, "").slice(0, 4))} inputMode="numeric" pattern="[0-9]{4}" minLength={4} maxLength={4} placeholder="0000" autoComplete="off" required disabled={save.isPending} /></label>
          <label className="grid min-w-0 gap-2 text-sm font-medium">{t("credit_cards_expiry")} (MM/YY)<Input type="text" inputMode="numeric" value={expiry} onChange={event => {
            const digits = event.target.value.replace(/\D/g, "").slice(0, 4);
            setExpiry(digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits);
          }} placeholder="MM/YY" pattern="(0[1-9]|1[0-2])/[0-9]{2}" minLength={5} maxLength={5} autoComplete="off" required disabled={save.isPending} /></label>
        </div>
        <label className="grid gap-2 text-sm font-medium">{t("credit_cards_statement_day_optional")}
          <Input type="number" inputMode="numeric" min={1} max={31} step={1} value={statementDay} disabled={save.isPending || reading} placeholder="1–31" onChange={event => setStatementDay(event.target.value)} />
          <span className="text-xs font-normal text-muted-foreground">{t("credit_cards_statement_day_help")}</span>
        </label>
        {supportedCardBank(bank) === "enpara" && <p className="text-xs text-muted-foreground">{t("credit_cards_enpara_due_help")}</p>}
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0 accent-primary" checked={adjustWeekend} disabled={save.isPending || reading || !statementDay} onChange={event => setAdjustWeekend(event.target.checked)} />
          <span>{t("credit_cards_weekend_adjust")}<span className="mt-1 block text-xs text-muted-foreground">{t("credit_cards_weekend_help")}</span></span>
        </label>
        <div aria-label={t("credit_cards_preview")} className="mx-auto w-full max-w-sm"><CreditCardFace card={values} /></div>
        {archiveMode && (unassigned.isPending ? <Loader2 className="h-5 w-5 animate-spin" aria-label={t("loading")} /> : unassigned.isError ?
          <div role="alert" className="space-y-2 text-sm text-destructive"><p>{t("statement_load_failed")}</p><Button type="button" variant="outline" onClick={() => void unassigned.refetch()}>{t("statement_import_retry")}</Button></div> :
          <fieldset disabled={save.isPending}><StatementChoices statements={matching} selected={selected} onChange={setSelected} /></fieldset>)}
        {save.error && <p role="alert" className="text-sm text-destructive">{t(errorKey(save.error, "credit_cards_save_failed"))}</p>}
        <DialogFooter className="gap-2"><Button type="button" variant="outline" disabled={save.isPending} onClick={onClose}>{t("cancel")}</Button>
          <Button type="submit" disabled={save.isPending || reading || !bank.trim() || lastFour.length !== 4 || !validExpiry || (archiveMode && (unassigned.isPending || unassigned.isError || !selected.length))}>
            {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{t("save")}
          </Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}

export function AssignCardStatementsDialog({ userId, cards, card, source, onClose, onCreate, onSaved }: {
  userId: string; cards: CreditCard[]; card?: CreditCard; source?: CardStatement;
  onClose: () => void; onCreate: (source?: CardStatement) => void; onSaved: (id: string) => Promise<void>;
}) {
  const { t } = useTranslation();
  const choices = cards.filter(item => !source || item.bank === source.bank);
  const [cardId, setCardId] = useState(card?.id || choices[0]?.id || "");
  const [selected, setSelected] = useState<string[]>(source ? [source.id] : []);
  const unassigned = useQuery({ queryKey: unassignedStatementsKey(userId), queryFn: creditCardsService.unassigned });
  const target = cards.find(item => item.id === cardId);
  const matching = (unassigned.data ?? []).filter(statement => statement.bank === target?.bank);
  const assign = useMutation({ mutationFn: () => creditCardsService.assign(cardId, selected), onSuccess: () => onSaved(cardId) });
  return <Dialog open onOpenChange={open => { if (!open && !assign.isPending) onClose(); }}>
    <DialogContent className="max-h-[90dvh] overflow-y-auto rounded-3xl sm:max-w-xl" onInteractOutside={event => { if (assign.isPending) event.preventDefault(); }}>
      <DialogHeader><DialogTitle>{t("credit_cards_assign_many")}</DialogTitle><DialogDescription>{source ? `${cardBankName(source.bank)} · ${source.period} · ${source.file_name}` : t("credit_cards_unassigned_help")}</DialogDescription></DialogHeader>
      {card ? <p className="text-sm font-medium">{creditCardLabel(card)}</p> :
        <label className="grid gap-2 text-sm font-medium">{t("credit_cards_choose")}<ThemedSelect value={cardId} disabled={assign.isPending} onChange={event => { setCardId(event.target.value); setSelected(source ? [source.id] : []); assign.reset(); }}>
          <option value="">{t("credit_cards_choose")}</option>{choices.map(item => <option key={item.id} value={item.id}>{creditCardLabel(item)}</option>)}
        </ThemedSelect></label>}
      {!card && <Button type="button" variant="outline" className="gap-2" disabled={assign.isPending} onClick={() => onCreate(source)}><Plus className="h-4 w-4" />{t("credit_cards_create_title")}</Button>}
      {unassigned.isPending ? <Loader2 className="h-5 w-5 animate-spin" aria-label={t("loading")} /> : unassigned.isError ?
        <div role="alert" className="space-y-2 text-sm text-destructive"><p>{t("statement_load_failed")}</p><Button variant="outline" onClick={() => void unassigned.refetch()}>{t("statement_import_retry")}</Button></div> : target &&
        <fieldset disabled={assign.isPending}><StatementChoices statements={matching} selected={selected} onChange={setSelected} /></fieldset>}
      {assign.error && <p role="alert" className="text-sm text-destructive">{t(errorKey(assign.error, "credit_cards_assign_failed"))}</p>}
      <DialogFooter className="gap-2"><Button type="button" variant="outline" disabled={assign.isPending} onClick={onClose}>{t("cancel")}</Button>
        <Button disabled={!target || !selected.length || assign.isPending || unassigned.isPending || unassigned.isError} onClick={() => assign.mutate()}>{assign.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{t("credit_cards_assign")}</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}
