/** Escape text and attribute values before writing OOXML parts. */
export function escapeSpreadsheetXml(value: string | number): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Replace an OOXML style collection, creating it when an input writer omitted it. */
export function replaceSpreadsheetStyleCollection(
  styles: string,
  tag: string,
  children: string,
  count: number,
): string {
  const content = `<${tag} count="${count}">${children}</${tag}>`;
  const pattern = new RegExp(`<${tag}\\b[^>]*(?:\\/>|>[\\s\\S]*?<\\/${tag}>)`);
  return pattern.test(styles)
    ? styles.replace(pattern, content)
    : styles.replace("</styleSheet>", content + "</styleSheet>");
}
