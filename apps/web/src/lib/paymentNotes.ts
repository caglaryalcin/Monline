const RECOVERY_NOTES = new Set([
  "Sürüm geçişinde mevcut ödeme planından tamamlandı. Tutar tahminidir; ödendi bilgisi onaylanmadı.",
  "Recovered from the current billing schedule during upgrade. Amount is estimated; payment is not confirmed.",
]);
export const isRecoveredPaymentNote = (notes?: string) => RECOVERY_NOTES.has(notes ?? "");
export const editablePaymentNotes = (notes?: string) =>
  isRecoveredPaymentNote(notes) ? "" : (notes ?? "");
