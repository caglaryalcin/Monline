import { getDocument, GlobalWorkerOptions, OPS } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

import { cleanStatementText, hasStatementControlGlyphs } from "@/lib/statementDetails";
import { readStatementFile } from "@/lib/statementFile";
import { recoverStatementGlyphs } from "@/lib/statementGlyphs";
import { statementPageLines } from "@/lib/statementPdfLayout";
import type { StatementLine } from "@/lib/statements";

GlobalWorkerOptions.workerSrc = workerUrl;

export async function readStatementPdf(
  file: File,
  password: string,
  onProgress: (page: number, total: number) => void,
  signal: AbortSignal,
) {
  const { buffer, fileHash } = await readStatementFile(file);
  const base = new URL(`${import.meta.env.BASE_URL}pdfjs/`, document.baseURI).href;
  const task = getDocument({
    data: new Uint8Array(buffer),
    password: password || undefined,
    cMapUrl: `${base}cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `${base}standard_fonts/`,
    wasmUrl: `${base}wasm/`,
    useSystemFonts: false,
    fontExtraProperties: true,
  });
  const abort = () => {
    void task.destroy();
  };
  signal.addEventListener("abort", abort, { once: true });
  const lines: StatementLine[] = [];
  let emptyPages = 0;
  let textLength = 0;
  let controlGlyphs = false;
  let inspectFontGlyphs = false;
  try {
    if (signal.aborted) throw new DOMException("Aborted", "AbortError");
    const pdf = await task.promise;
    if (pdf.numPages > 80) throw new Error("statement_too_many_pages");
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      if (signal.aborted) throw new DOMException("Aborted", "AbortError");
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent({ disableNormalization: true });
      inspectFontGlyphs ||= content.items.some(
        (item) =>
          "str" in item &&
          (/enpara/i.test(item.str) ||
            Array.from(item.str).some((char) => char.charCodeAt(0) < 32)),
      );
      controlGlyphs ||= content.items.some(
        (item) => "str" in item && hasStatementControlGlyphs(item.str),
      );
      textLength += content.items.reduce(
        (sum, item) => sum + ("str" in item ? item.str.length : 0),
        0,
      );
      if (textLength > 2000000) throw new Error("statement_too_many_pages");
      if (content.items.length > 100000) throw new Error("statement_too_many_pages");
      const recovered =
        inspectFontGlyphs && typeof page.getOperatorList === "function"
          ? recoverStatementGlyphs(await page.getOperatorList(), OPS, (id) => {
              const font = page.commonObjs.get(id) as { name?: unknown };
              return typeof font?.name === "string" ? font.name : "";
            })
          : { fonts: new Set<string>(), items: [] };
      const items = content.items.flatMap((item) =>
        "str" in item &&
        !recovered.fonts.has(item.fontName) &&
        cleanStatementText(item.str, controlGlyphs).trim()
          ? [
              {
                text: cleanStatementText(item.str, controlGlyphs),
                x: item.transform[4] as number,
                y: item.transform[5] as number,
                width: Math.abs(item.width),
                height: Math.abs(item.height),
              },
            ]
          : [],
      );
      items.push(...recovered.items);
      if (!items.length) emptyPages++;
      lines.push(...statementPageLines(items, pageNumber));
      if (lines.length > 25000) throw new Error("statement_too_many_pages");
      page.cleanup();
      onProgress(pageNumber, pdf.numPages);
    }
    if (!lines.length) throw new Error("statement_no_text");
    return { lines, fileHash, pageCount: pdf.numPages, emptyPages };
  } finally {
    signal.removeEventListener("abort", abort);
    await task.destroy();
  }
}
