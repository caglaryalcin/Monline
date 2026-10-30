import type { StatementPdfFragment } from "./statementPdfLayout";

// Verified against the visible letters and glyph codes in Enpara's embedded
// Arial_BoldMT4 subset. This profile is never applied to arbitrary PDF fonts.
const ENPARA_GLYPHS: Record<number, string> = {
  0: "ö",
  1: "Ö",
  2: "ü",
  3: "ğ",
  4: "İ",
  5: "ş",
  6: "ç",
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
type Matrix = [number, number, number, number, number, number];
type OpName =
  | "save"
  | "restore"
  | "transform"
  | "beginText"
  | "setFont"
  | "setCharSpacing"
  | "setWordSpacing"
  | "setHScale"
  | "setLeading"
  | "setTextRise"
  | "setTextMatrix"
  | "moveText"
  | "setLeadingMoveText"
  | "nextLine"
  | "showText"
  | "showSpacedText"
  | "nextLineShowText"
  | "nextLineSetSpacingShowText"
  | "paintFormXObjectBegin"
  | "paintFormXObjectEnd";
export type StatementTextOperators = Record<OpName, number>;
export interface StatementOperatorList {
  fnArray: readonly number[];
  argsArray: readonly (readonly unknown[])[];
}
const identity = (): Matrix => [1, 0, 0, 1, 0, 0];
const multiply = (a: Matrix, b: Matrix): Matrix => [
  a[0] * b[0] + a[2] * b[1],
  a[1] * b[0] + a[3] * b[1],
  a[0] * b[2] + a[2] * b[3],
  a[1] * b[2] + a[3] * b[3],
  a[0] * b[4] + a[2] * b[5] + a[4],
  a[1] * b[4] + a[3] * b[5] + a[5],
];
const translated = (m: Matrix, x: number, y: number): Matrix => [
  m[0],
  m[1],
  m[2],
  m[3],
  m[4] + m[0] * x + m[2] * y,
  m[5] + m[1] * x + m[3] * y,
];
const matrix = (values: unknown): Matrix | undefined => {
  const array = Array.isArray(values)
    ? values
    : ArrayBuffer.isView(values) && !(values instanceof DataView)
      ? Array.from(values as unknown as ArrayLike<unknown>)
      : undefined;
  return array?.length === 6 && array.every((v) => typeof v === "number" && Number.isFinite(v))
    ? ([...array] as Matrix)
    : undefined;
};
interface State {
  ctm: Matrix;
  text: Matrix;
  line: Matrix;
  font: string;
  size: number;
  charSpace: number;
  wordSpace: number;
  scale: number;
  leading: number;
  rise: number;
}
const clone = (s: State): State => ({
  ...s,
  ctm: [...s.ctm],
  text: [...s.text],
  line: [...s.line],
});

/** Recover letters before getTextContent's whitespace handling can erase Ş.
 * Amount fonts and their glyphs are never replaced by this letter-only profile. */
export function recoverStatementGlyphs(
  list: StatementOperatorList,
  ops: StatementTextOperators,
  fontName: (id: string) => string,
) {
  if (list.fnArray.length > 500000) throw new Error("statement_too_many_pages");
  let state: State = {
    ctm: identity(),
    text: identity(),
    line: identity(),
    font: "",
    size: 0,
    charSpace: 0,
    wordSpace: 0,
    scale: 1,
    leading: 0,
    rise: 0,
  };
  const stack: State[] = [],
    candidates = new Set<string>(),
    failed = new Set<string>(),
    seenFallback = new Set<string>();
  const recovered: { font: string; item: StatementPdfFragment }[] = [];
  const move = (x: number, y: number) => {
    state.line = translated(state.line, x, y);
    state.text = [...state.line];
  };
  const show = (values: unknown) => {
    if (!Array.isArray(values)) {
      if (candidates.has(state.font)) failed.add(state.font);
      return;
    }
    for (const entry of values) {
      if (typeof entry === "number") {
        state.text = translated(state.text, (-entry * state.size * state.scale) / 1000, 0);
        continue;
      }
      if (!entry || typeof entry !== "object") {
        if (candidates.has(state.font)) failed.add(state.font);
        continue;
      }
      const glyph = entry as {
        originalCharCode?: number;
        unicode?: string;
        fontChar?: string;
        width?: number;
        isSpace?: boolean;
      };
      const width = glyph.width;
      if (typeof width !== "number" || !Number.isFinite(width)) {
        if (candidates.has(state.font)) failed.add(state.font);
        continue;
      }
      if (candidates.has(state.font)) {
        const code = glyph.originalCharCode,
          letter = code === undefined ? undefined : ENPARA_GLYPHS[code];
        const raw = code === undefined ? undefined : Number.parseInt(String(code), 16);
        const matches =
          letter &&
          glyph.isSpace !== true &&
          glyph.fontChar?.codePointAt(0) === 0xe000 + code! &&
          (glyph.unicode?.codePointAt(0) === raw || glyph.unicode === letter);
        const at = multiply(state.ctm, translated(state.text, 0, state.rise));
        const height = Math.abs(state.size) * Math.hypot(at[2], at[3]);
        const glyphWidth =
          Math.abs((width * state.size * state.scale) / 1000) * Math.hypot(at[0], at[1]);
        if (!matches || ![...at, height, glyphWidth].every(Number.isFinite) || height === 0)
          failed.add(state.font);
        else {
          if (glyph.unicode?.codePointAt(0) === raw) seenFallback.add(state.font);
          recovered.push({
            font: state.font,
            item: { text: letter!, x: at[4], y: at[5], width: glyphWidth, height },
          });
        }
      }
      const advance =
        ((width * state.size) / 1000 + state.charSpace + (glyph.isSpace ? state.wordSpace : 0)) *
        state.scale;
      state.text = translated(state.text, advance, 0);
    }
  };
  for (let i = 0; i < list.fnArray.length; i++) {
    const fn = list.fnArray[i],
      args = list.argsArray[i] || [];
    if (fn === ops.save) stack.push(clone(state));
    else if (fn === ops.restore) {
      const saved = stack.pop();
      if (saved) state = saved;
    } else if (fn === ops.transform) {
      const m = matrix(args);
      if (m) state.ctm = multiply(state.ctm, m);
      else failed.add(state.font);
    } else if (fn === ops.paintFormXObjectBegin) {
      stack.push(clone(state));
      const m = matrix(args[0]);
      if (m) state.ctm = multiply(state.ctm, m);
    } else if (fn === ops.paintFormXObjectEnd) {
      const saved = stack.pop();
      if (saved) state = saved;
    } else if (fn === ops.beginText) {
      state.text = identity();
      state.line = identity();
    } else if (fn === ops.setFont) {
      state.font = String(args[0]);
      state.size = Number(args[1]);
      if (/(?:^|\+)Arial_BoldMT4$/.test(fontName(state.font))) candidates.add(state.font);
    } else if (fn === ops.setCharSpacing) state.charSpace = Number(args[0]);
    else if (fn === ops.setWordSpacing) state.wordSpace = Number(args[0]);
    else if (fn === ops.setHScale) state.scale = Number(args[0]) / 100;
    else if (fn === ops.setLeading) state.leading = Number(args[0]);
    else if (fn === ops.setTextRise) state.rise = Number(args[0]);
    else if (fn === ops.setTextMatrix) {
      const m = matrix(args.length === 1 ? args[0] : args);
      if (m) {
        state.text = m;
        state.line = [...m];
      } else failed.add(state.font);
    } else if (fn === ops.moveText) move(Number(args[0]), Number(args[1]));
    else if (fn === ops.setLeadingMoveText) {
      state.leading = -Number(args[1]);
      move(Number(args[0]), Number(args[1]));
    } else if (fn === ops.nextLine) move(0, -state.leading);
    else if (fn === ops.showText || fn === ops.showSpacedText) show(args[0]);
    else if (fn === ops.nextLineShowText) {
      move(0, -state.leading);
      show(args[0]);
    } else if (fn === ops.nextLineSetSpacingShowText) {
      state.wordSpace = Number(args[0]);
      state.charSpace = Number(args[1]);
      move(0, -state.leading);
      show(args[2]);
    }
  }
  const fonts = new Set([...seenFallback].filter((font) => !failed.has(font)));
  return {
    fonts,
    items: recovered.filter((entry) => fonts.has(entry.font)).map((entry) => entry.item),
  };
}
