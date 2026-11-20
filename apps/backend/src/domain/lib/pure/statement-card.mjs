const fold = value => value.replace(/ı/g, "i").replace(/İ/g, "I").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const MASK = /[*xX•●·∗#]/;
const CARD_LABEL = /\b(?:kart(?:i|inizin|iniz|in)?\s*(?:numara(?:si|niz)?|no(?:\.?su)?|bilgi(?:leri)?)|(?:asil|ek|sanal)\s+kart|(?:credit\s+)?card\s*(?:number|no\b|ending)|kreditkarten(?:nummer)?)\b/;
const EXPIRY = /\b(?:son\s+kullan(?:ma|im)(?:\s+tarihi)?|s\.?k\.?t\.?|valid\s*(?:thru|through|until)|expir(?:y|ation)(?:\s+date)?|expires|gultig\s+bis)\s*[:.\-]?\s*(0?[1-9]|1[0-2])\s*[/.-]\s*(20\d{2}|\d{2})(?!\d|[/.-]\d)/g;

/** Keep only the suffix and an explicitly labelled expiry; never return a full PAN. */
export function detectStatementCard(lines) {
  const suffixes = new Set(), expiries = new Set();
  const source = (Array.isArray(lines) ? lines : []).filter(line => typeof line?.text === "string").slice(0, 25000);
  for (let index = 0; index < source.length; index++) {
    const line = source[index];
    if (line.layout_issue) continue;
    const next = source[index + 1];
    const text = fold(line.text);
    // A label and its value can be on separate PDF lines, but not separate pages.
    const labelled = CARD_LABEL.test(text);
    const window = text + (next?.page === line.page && !next.layout_issue ? " " + fold(next.text) : "");
    for (const match of window.matchAll(EXPIRY)) {
      const year = match[2].length === 2 ? `20${match[2]}` : match[2];
      expiries.add(`${year}-${match[1].padStart(2, "0")}`);
    }
    // Masked numbers can be recognized by shape even when their label is absent.
    // Do not join lines here: doing so can swallow the start of a transaction.
    for (const match of line.text.matchAll(/(?<![\d*xX•●·∗#])(?:\d[ \t\u00a0-]*){0,8}(?:[*xX•●·∗#][ \t\u00a0-]*){4,15}\d(?:[ \t-]?\d){3}(?!\d)/g)) {
      const token = match[0].replace(/[\s-]/g, "");
      if (token.length >= 8 && token.length <= 19 && /^\d{4}$/.test(token.slice(-4)) &&
          [...token].filter(char => MASK.test(char)).length >= 4 && MASK.test(token.slice(0, -4)))
        suffixes.add(token.slice(-4));
    }
    for (const match of window.matchAll(/\b(?:son\s*(?:4|dort)\s*(?:hane(?:si)?|rakam(?:i)?)|(?:card\s+)?ending\s*(?:in|with)?|last\s*(?:4|four)\s*digits)\s*[:*•.\s-]*?(\d{4})(?!\d)/g)) suffixes.add(match[1]);
    if (labelled) {
      const afterLabel = window.slice(window.search(CARD_LABEL));
      for (const match of afterLabel.matchAll(/(?<!\d)(?:\d[ \t-]?){12,18}\d(?!\d)/g)) {
        const digits = match[0].replace(/\D/g, "");
        // Unmasked numbers require both an explicit card label and a valid checksum.
        if (digits.length < 13 || digits.length > 19 || !/^[3456]/.test(digits)) continue;
        let sum = 0;
        for (let position = 0; position < digits.length; position++) {
          let digit = Number(digits[digits.length - 1 - position]);
          if (position % 2) { digit *= 2; if (digit > 9) digit -= 9; }
          sum += digit;
        }
        if (sum % 10 === 0) suffixes.add(digits.slice(-4));
      }
    }
  }
  const candidates = [...suffixes].sort();
  return {
    ...(candidates.length === 1 ? { last_four: candidates[0] } : candidates.length > 1 ? { candidates } : {}),
    ...(candidates.length <= 1 && expiries.size === 1 ? { expiry: [...expiries][0] } : {}),
  };
}

export function validateStatementCard(value) {
  if (value == null) return {};
  if (typeof value !== "object" || Array.isArray(value)) throw new Error("credit_cards_invalid_details");
  const result = {};
  if (value.last_four !== undefined) {
    if (typeof value.last_four !== "string" || !/^\d{4}$/.test(value.last_four)) throw new Error("credit_cards_invalid_details");
    result.last_four = value.last_four;
  }
  if (value.expiry !== undefined) {
    if (typeof value.expiry !== "string" || !/^20\d{2}-(0[1-9]|1[0-2])$/.test(value.expiry)) throw new Error("credit_cards_invalid_details");
    result.expiry = value.expiry;
  }
  if (value.candidates !== undefined) {
    if (!Array.isArray(value.candidates) || value.candidates.length > 50 || value.candidates.some(item => typeof item !== "string" || !/^\d{4}$/.test(item))) throw new Error("credit_cards_invalid_details");
    result.candidates = [...new Set(value.candidates)];
    if (result.last_four && !result.candidates.includes(result.last_four)) throw new Error("credit_cards_invalid_details");
  }
  return result;
}

export function savedStatementCard(statement) {
  const lines = [...(statement.unresolved || []), ...(statement.transactions || []), ...(statement.excluded_transactions || [])]
    .map(item => ({ page: item.page || 1, text: item.text || item.source || "" }));
  return { ...detectStatementCard(lines), ...validateStatementCard(statement.card_details) };
}
