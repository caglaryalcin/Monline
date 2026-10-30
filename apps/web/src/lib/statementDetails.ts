import { parseStatementAmount, statementAmountTokens } from "./statementAmounts";
import { normalizeMerchant } from "./statementCategories";
import type {
  StatementAccountSummary,
  StatementBank,
  StatementLine,
  StatementTransaction,
} from "./statements";

const CID: Record<string, string> = {
  7: "ö",
  8: "Ö",
  9: "Ş",
  10: "ü",
  11: "ğ",
  12: "ş",
  13: "İ",
  14: "Ü",
  15: "Ğ",
  16: "Ç",
  17: "ç",
};
const CONTROL_GLYPH_IDS = new Set([7, 8, 11, 12, 14, 15, 16, 17]);
export function hasStatementControlGlyphs(text: string) {
  for (const char of text) if (CONTROL_GLYPH_IDS.has(char.charCodeAt(0))) return true;
  return false;
}
export function hasUnresolvedStatementText(text: string) {
  return (
    /\(cid:\d+\)|�/.test(text) ||
    Array.from(text).some((char) => {
      const code = char.charCodeAt(0);
      return code < 32 && ![9, 10, 13].includes(code);
    })
  );
}

// Some Enpara fonts expose the reference CID values as raw control characters.
// Decode before whitespace handling can erase Ş, ü or İ glyphs.
export function cleanStatementText(text: string, controlGlyphs = hasStatementControlGlyphs(text)) {
  let cleaned = text.replace(/\(cid:(\d+)\)/g, (original, id: string) => CID[id] || original);
  if (controlGlyphs)
    cleaned = Array.from(cleaned, (char) => CID[String(char.charCodeAt(0))] || char).join("");
  const mojibake: [string, string][] = [
    ["Ã¶", "ö"],
    ["Ã–", "Ö"],
    ["Ã¼", "ü"],
    ["Ãœ", "Ü"],
    ["ÄŸ", "ğ"],
    ["Äž", "Ğ"],
    ["ÅŸ", "ş"],
    ["Åž", "Ş"],
    ["Ä±", "ı"],
    ["Ä°", "İ"],
    ["Ã§", "ç"],
    ["Ã‡", "Ç"],
  ];
  for (const [broken, correct] of mojibake) cleaned = cleaned.split(broken).join(correct);
  return (
    cleaned
      // Some text layers repeat the initial Ö (for example, a control glyph plus
      // a Unicode glyph). Repair only the known bank-payment descriptor.
      .replace(/(^|\s)(?:[oö]\s*)*deme\s*[-–—:]\s*Enpara\.com(?=\s|$)/gi, "$1Ödeme - Enpara.com")
      .replace(/\b(Enpara\.com\s+Cep)\s+(?:ubesi|subesi|şubesi)\b/gi, "$1 Şubesi")
      .normalize("NFC")
  );
}

export function isStatementRepayment(description: string) {
  const text = normalizeMerchant(cleanStatementText(description));
  if (/\b(?:iade\w*|iptal\w*|refund\w*|reversal\w*)\b/.test(text)) return false;
  return (
    /^odeme(?:niz)?(?:\s*(?:-|:|$)|\s+(?:icin|tesekkur)\b)/.test(text) ||
    /odemeniz|odeme tesekkur|kart (?:borc|odeme)|kredi karti(?: borc)? odeme|hesaptan odeme|otomatik odeme tahsilat/.test(
      text,
    )
  );
}

export function repairStatementTransactions<T extends StatementTransaction>(rows: T[]): T[] {
  const controlGlyphs = rows.some(
    (row) => hasStatementControlGlyphs(row.merchant) || hasStatementControlGlyphs(row.source || ""),
  );
  return rows.map((row) => {
    const merchant = cleanStatementText(row.merchant, controlGlyphs);
    return {
      ...row,
      merchant,
      ...(row.source ? { source: cleanStatementText(row.source, controlGlyphs) } : {}),
      ...(isStatementRepayment(merchant)
        ? {
            kind: "repayment" as const,
            category: "other" as const,
            subscription_service: undefined,
            subscription_match: undefined,
          }
        : {}),
    };
  });
}
export function readFinancing(text: string, amount: number): StatementTransaction["financing"] {
  const normalized = normalizeMerchant(text);
  const fields = { principal: "anapara", interest: "faiz", kkdf: "kkdf", bsmv: "bsmv" };
  const result: Record<string, number> = {};
  for (const [key, name] of Object.entries(fields)) {
    const found = normalized.match(new RegExp(`\\b${name}\\s*:\\s*([\\d.,]+)\\s*tl\\b`));
    if (!found) return;
    const value = parseStatementAmount(found[1]);
    if (!value || value.credit) return;
    result[key] = value.amount;
  }
  if (
    Math.abs(
      Object.values(result).reduce((sum, value) => sum + Math.round(value * 100), 0) -
        Math.round(amount * 100),
    ) > 5
  )
    return;
  return result as NonNullable<StatementTransaction["financing"]>;
}

export function readStatementSummary(
  lines: StatementLine[],
  bank: StatementBank | "",
): StatementAccountSummary {
  const summary: StatementAccountSummary = {};
  const labels: [keyof StatementAccountSummary, RegExp][] = [
    [
      "previous_balance",
      /(?:onceki (?:ekstre|donem) (?:borcu|bakiyesi)|devreden bakiye)\s*[:=]?\s*/,
    ],
    ["payments", /(?:yapilan odemeler|donem ici odemeler|toplam odeme)\s*[:=]?\s*/],
    ["purchases", /(?:donem ici harcamalar|toplam harcama(?:lar)?)\s*[:=]?\s*/],
    ["cash", /(?:toplam nakit avans|nakit avans toplami)\s*[:=]?\s*/],
    ["fees", /(?:toplam faiz ve (?:vergiler|ucretler)|faiz ve ucretler toplami)\s*[:=]?\s*/],
    ["balance", /(?:ekstre borcu|donem borcu|donem toplam borcu|hesap ozeti borcu)\s*[:=]?\s*/],
    [
      "minimum_payment",
      /(?:(?:minimum|asgari) odeme tutari|odenmesi gereken asgari tutar)\s*[:=]?\s*/,
    ],
  ];
  for (const [lineIndex, line] of lines.entries()) {
    const text = normalizeMerchant(cleanStatementText(line.text));
    // Enpara's six-column summary has an established order in the reference parser.
    const amounts = statementAmountTokens(text);
    const unlabelled = amounts.filter((token) => !/tl$/i.test(token.text));
    let wrappedCurrency = false;
    if (bank === "enpara" && amounts.length === 6 && unlabelled.length === 1 &&
      /^\d[\d., ]*[,.]\d{2}$/.test(unlabelled[0].text)) {
      const next = lines[lineIndex + 1];
      const heading = lines.slice(Math.max(0, lineIndex - 5), lineIndex)
        .filter((previous) => previous.page === line.page)
        .map((previous) => normalizeMerchant(cleanStatementText(previous.text))).join(" ");
      let residue = "", end = 0;
      for (const token of amounts) {
        residue += text.slice(end, token.start);
        end = token.end;
      }
      residue += text.slice(end);
      // The currency may wrap below one column in the PDF. Accept it only
      // with all six summary headings, exactly one bare amount and an adjacent
      // standalone TL on the same page. Never infer it from a balance equation.
      wrappedCurrency = !!next && next.page === line.page &&
        normalizeMerchant(cleanStatementText(next.text)).trim() === "tl" &&
        ["onceki", "odemeler", "harcamalar", "nakit avans", "faiz", "ekstre borcu"]
          .every((label) => heading.includes(label)) && !residue.trim();
    }
    if (
      bank === "enpara" &&
      amounts.length === 6 &&
      amounts.every(
        (token) => token.currency === "TRY" && !token.credit &&
          (/tl$/i.test(token.text) || wrappedCurrency),
      ) &&
      // A balance such as 74.281,90 starts with two digits and a dot too.
      // Exclude actual dated transaction lines, not grouped monetary values.
      !/^\d{1,2}[./-]\d{1,2}[./-]\d{2,4}(?:\s|$)/.test(text.trim())
    ) {
      const keys = [
        "previous_balance",
        "payments",
        "purchases",
        "cash",
        "fees",
        "balance",
      ] as const;
      for (const [index, key] of keys.entries()) {
        if (summary[key] === undefined) summary[key] = amounts[index].amount;
      }
    }
    for (const [key, pattern] of labels) {
      const match = pattern.exec(text);
      if (!match || (key === "balance" && /onceki/.test(text.slice(0, match.index)))) continue;
      const rest = text.slice(match.index + match[0].length);
      const money = statementAmountTokens(rest)[0];
      // Never use an unrelated later number when the label has no adjacent amount.
      if (!money || rest.slice(0, money.start).trim() || money.currency !== "TRY" || money.credit)
        continue;
      if (summary[key] === undefined) summary[key] = money.amount;
    }
  }
  return summary;
}
