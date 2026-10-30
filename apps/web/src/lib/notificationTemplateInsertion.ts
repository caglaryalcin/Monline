type TemplateInput = HTMLInputElement | HTMLTextAreaElement;

/** Plan insertion before touching editor state; unavailable fields must stay unchanged. */
export function notificationTemplateInsertion(
  input: TemplateInput | null | undefined,
  variable: string,
  unavailable: boolean,
) {
  if (!input || unavailable) return null;
  const token = `{{${variable}}}`;
  const start = input.selectionStart ?? input.value.length;
  const end = input.selectionEnd ?? start;
  const value = input.value.slice(0, start) + token + input.value.slice(end);
  if (input.maxLength >= 0 && value.length > input.maxLength) return null;
  return { input, value, cursor: start + token.length };
}
