import { getDocument,GlobalWorkerOptions } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

import type { StatementLine } from "@/lib/statements";

GlobalWorkerOptions.workerSrc = workerUrl;

export async function readStatementPdf(file: File, password: string, onProgress: (page: number, total: number) => void, signal: AbortSignal) {
  if (!/\.pdf$/i.test(file.name) || file.size > 20 * 1024 * 1024) throw new Error("statement_invalid_file");
  const buffer = await file.arrayBuffer();
  const header = new TextDecoder().decode(buffer.slice(0, 1024));
  if (!header.includes("%PDF-")) throw new Error("statement_invalid_file");
  if (!globalThis.crypto?.subtle) throw new Error("statement_secure_context");
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  const fileHash = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
  const base = new URL(`${import.meta.env.BASE_URL}pdfjs/`, document.baseURI).href;
  const task = getDocument({
    data: new Uint8Array(buffer), password: password || undefined,
    cMapUrl: `${base}cmaps/`, cMapPacked: true,
    standardFontDataUrl: `${base}standard_fonts/`, wasmUrl: `${base}wasm/`,
    useSystemFonts: false,
  });
  const abort = () => { void task.destroy(); };
  signal.addEventListener("abort", abort, { once: true });
  const lines: StatementLine[] = [];
  let emptyPages = 0;
  let textLength = 0;
  try {
    if (signal.aborted) throw new DOMException("Aborted", "AbortError");
    const pdf = await task.promise;
    if (pdf.numPages > 80) throw new Error("statement_too_many_pages");
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      if (signal.aborted) throw new DOMException("Aborted", "AbortError");
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      textLength += content.items.reduce((sum, item) => sum + ("str" in item ? item.str.length : 0), 0);
      if (textLength > 2000000) throw new Error("statement_too_many_pages");
      if (content.items.length > 100000) throw new Error("statement_too_many_pages");
      const items = content.items.flatMap((item) => "str" in item && item.str.trim()
        ? [{ text: item.str, x: item.transform[4] as number, y: item.transform[5] as number,
          width: Math.abs(item.width), height: Math.abs(item.height) }] : []);
      // PDF reading order is not necessarily visual row order.
      items.sort((a, b) => b.y - a.y || a.x - b.x);
      const rows: { y: number; items: typeof items }[] = [];
      for (const item of items) {
        const previous = rows[rows.length - 1];
        if (previous && Math.abs(previous.y - item.y) < 2.5) previous.items.push(item);
        else rows.push({ y: item.y, items: [item] });
      }
      if (!items.length) emptyPages++;
      for (const row of rows) {
        const sorted = row.items.sort((a, b) => a.x - b.x);
        const text = sorted.map((item, index) => {
          const previous = sorted[index - 1];
          const gap = previous ? item.x - previous.x - previous.width : 0;
          const separator = previous && gap > Math.max(1.2, item.height * .15) ? " " : "";
          return separator + item.text;
        }).join("").replace(/\s+/g, " ").trim();
        if (text) lines.push({ page: pageNumber, text });
      }
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
