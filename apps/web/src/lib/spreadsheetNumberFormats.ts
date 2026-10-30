/** Keep custom number formats out of Excel's reserved built-in ID range. */
export function normalizeSpreadsheetNumberFormats(styles: string) {
  // SheetJS can allocate custom formats in the reserved built-in range
  // (60–163). Excel tolerates this, but other importers can interpret those
  // IDs as built-ins instead of the supplied currency/month format.
  const customFormats = new Map<number, number>();
  let nextFormat = 164;
  styles = styles.replace(
    /<numFmt\b([^>]*?)numFmtId="(\d+)"([^>]*?)\/>/g,
    (_tag, before, id, after) => {
      const number = nextFormat++;
      customFormats.set(Number(id), number);
      return `<numFmt${before}numFmtId="${number}"${after}/>`;
    },
  );
  const originalFormats = [
    ...(styles.match(/<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/)?.[1] || "").matchAll(
      /<xf\b([^>]*?)(?:\/>|>[\s\S]*?<\/xf>)/g,
    ),
  ].map((match) => {
    const id = Number(match[1].match(/numFmtId="(\d+)"/)?.[1] || 0);
    return customFormats.get(id) ?? id;
  });
  return { styles, originalFormats };
}
