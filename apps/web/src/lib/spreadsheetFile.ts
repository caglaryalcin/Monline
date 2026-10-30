import { CFB, type WorkBook, write } from "xlsx";

import { appearance, type SheetTone } from "./spreadsheetAppearance";
import { chartXml } from "./spreadsheetChart";
import { normalizeSpreadsheetNumberFormats } from "./spreadsheetNumberFormats";
import { styleWorksheetCellsXml, type WorksheetStyleResolver } from "./spreadsheetWorksheetCells";
import { layoutWorksheetXml } from "./spreadsheetWorksheetLayout";
import { escapeSpreadsheetXml as xml, replaceSpreadsheetStyleCollection } from "./spreadsheetXml";

type Archive = {
  FileIndex: { name: string; content?: Uint8Array; size: number }[];
  FullPaths: string[];
};
// SheetJS exposes its ZIP container API. Using it retains formulas, cached
// values and numeric formats while adding standard OOXML presentation parts.
const zip = CFB as {
  read: (data: Uint8Array, options: { type: string }) => Archive;
  find: (archive: Archive, name: string) => { content: Uint8Array } | null;
  write: (archive: Archive, options: { fileType: string; compression: boolean }) => Uint8Array;
  utils: { cfb_add: (archive: Archive, name: string, data: Uint8Array) => void };
};
const enc = new TextEncoder(),
  dec = new TextDecoder();
const rel = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const packageRel = "http://schemas.openxmlformats.org/package/2006/relationships";

export function writeSpreadsheet(
  workbook: WorkBook,
  theme: "dark" | "light" = "dark",
): Uint8Array<ArrayBuffer> {
  // Literal strings belong in the shared-string table. `t="str"` is a
  // formula-string result, and some Office importers drop literal cells that
  // use it. Keep formula caches and editable numeric cells as their own types.
  const original = new Uint8Array(
    write(workbook, { type: "array", bookType: "xlsx", compression: true, bookSST: true }),
  );
  const archive = zip.read(original, { type: "buffer" });
  const read = (path: string) => {
    const file = zip.find(archive, `/${path}`);
    return file ? dec.decode(file.content) : "";
  };
  const save = (path: string, value: string) =>
    zip.utils.cfb_add(archive, `/${path}`, enc.encode(value));
  const normalizedFormats = normalizeSpreadsheetNumberFormats(read("xl/styles.xml"));
  const originalFormats = normalizedFormats.originalFormats;
  let styles = normalizedFormats.styles,
    types = read("[Content_Types].xml");
  const dark = theme === "dark";
  const colors = {
    background: dark ? "262626" : "F8FAF8",
    body: dark ? "262626" : "FFFFFF",
    line: dark ? "384039" : "E2E8E2",
    text: "BFBFBF",
  };
  const looks: Record<
    SheetTone,
    { fg: string; bg: string; size?: number; bold?: boolean; underline?: boolean }
  > = {
    canvas: { fg: "BFBFBF", bg: "262626" },
    cardMonth: { fg: "F0F0F0", bg: "2D3B4C", size: 12, bold: true },
    cardCategory: { fg: "FF9000", bg: colors.body, size: 12, bold: true },
    cardPurchases: { fg: "FFD966", bg: colors.body, size: 10, bold: true, underline: true },
    cardBalance: { fg: "7DAE4B", bg: colors.body, size: 12 },
    cardMinimum: { fg: "D85636", bg: colors.body, size: 12 },
    body: { fg: colors.text, bg: colors.body },
    label: { fg: colors.text, bg: dark ? "1E2320" : "F8FAF8" },
    muted: { fg: dark ? "A7AFA9" : "64746A", bg: colors.background, size: 10 },
    title: { fg: colors.text, bg: colors.background, size: 20, bold: true },
    header: {
      fg: dark ? "D9FF65" : "425B09",
      bg: dark ? "30372A" : "EDF4DE",
      size: 10,
      bold: true,
    },
    salaryHeader: { fg: dark ? "D9FF65" : "425B09", bg: "2C394A", size: 10, bold: true },
    salaryYear: { fg: colors.text, bg: "2C394A", size: 12, bold: true },
    section: { fg: colors.text, bg: dark ? "2D352B" : "E9F0E5", size: 12, bold: true },
    income: { fg: dark ? "7DD3FC" : "0369A1", bg: dark ? "20333C" : "EAF6FD", bold: true },
    expense: { fg: dark ? "6EE7B7" : "047857", bg: dark ? "23362B" : "EAF8EF", bold: true },
    total: { fg: colors.text, bg: dark ? "2A332B" : "EDF4E9", bold: true, size: 12 },
    paid: { fg: dark ? "34D399" : "047857", bg: dark ? "203028" : "EFFAF3" },
    paidOlive: { fg: "87B337", bg: colors.body },
    billPaid: { fg: "87B337", bg: colors.body, bold: true },
    billStatus: { fg: colors.text, bg: colors.body },
    pending: { fg: dark ? "FB7185" : "BE123C", bg: dark ? "302326" : "FFF1F3" },
    partial: { fg: "DE8400", bg: dark ? "302B20" : "FFFBEB" },
    finished: { fg: dark ? "969D98" : "7B8680", bg: dark ? "272B28" : "F0F3F1" },
    sky: { fg: dark ? "7DD3FC" : "0369A1", bg: dark ? "20303A" : "EDF8FF", bold: true },
    violet: { fg: dark ? "C4B5FD" : "6D28D9", bg: dark ? "2D263A" : "F5F0FF", bold: true },
    amber: { fg: dark ? "FCD34D" : "92400E", bg: dark ? "332D20" : "FFFAE8", bold: true },
    tagGreen: { fg: "87B337", bg: dark ? "203028" : "EFFAF3", bold: true, size: 13 },
    tagSky: {
      fg: dark ? "7DD3FC" : "0369A1",
      bg: dark ? "20303A" : "EDF8FF",
      bold: true,
      size: 13,
    },
    tagAmber: {
      fg: dark ? "FCD34D" : "92400E",
      bg: dark ? "332D20" : "FFFAE8",
      bold: true,
      size: 13,
    },
    tagViolet: {
      fg: dark ? "C4B5FD" : "6D28D9",
      bg: dark ? "2D263A" : "F5F0FF",
      bold: true,
      size: 13,
    },
    ledgerBody: { fg: dark ? "C5C5C5" : "374151", bg: dark ? "262626" : "FFFFFF", size: 10.5 },
    ledgerLabel: {
      fg: dark ? "C5C5C5" : "374151",
      bg: dark ? "262626" : "FFFFFF",
      size: 10.5,
      bold: true,
    },
    ledgerTotal: { fg: "BFBFBF", bg: dark ? "262626" : "FFFFFF", size: 10.5, bold: true },
    ledgerHeader: { fg: "F5F5F5", bg: "2C394A", size: 10.5, bold: true },
    ledgerOverview: { fg: "FFFFFF", bg: "5B98D7", size: 12, bold: true },
    ledgerIncome: { fg: "FFFFFF", bg: "83AD43", size: 12, bold: true },
    ledgerExpense: { fg: "FFFFFF", bg: "C82F0B", size: 12, bold: true },
    ledgerPositive: { fg: dark ? "87B337" : "4D7C0F", bg: dark ? "262626" : "FFFFFF", size: 10.5 },
    ledgerNegative: { fg: dark ? "FF5028" : "C2410C", bg: dark ? "262626" : "FFFFFF", size: 10.5 },
    ledgerPositiveLabel: {
      fg: dark ? "87B337" : "4D7C0F",
      bg: dark ? "262626" : "FFFFFF",
      size: 10.5,
      bold: true,
    },
    ledgerNegativeLabel: {
      fg: dark ? "FF5028" : "C2410C",
      bg: dark ? "262626" : "FFFFFF",
      size: 10.5,
      bold: true,
    },
    // Match finance-sheet.css: received income = gray, settled expense =
    // muted foreground, pending expense = amber, expected income = blue.
    ledgerReceived: { fg: "BFBFBF", bg: dark ? "262626" : "FFFFFF", size: 10.5 },
    ledgerPaid: { fg: "BFBFBF", bg: dark ? "262626" : "FFFFFF", size: 10.5 },
    ledgerUnpaid: { fg: "DE8400", bg: dark ? "262626" : "FFFFFF", size: 10.5 },
    ledgerPartial: { fg: "DE8400", bg: dark ? "262626" : "FFFFFF", size: 10.5 },
    ledgerExpected: { fg: dark ? "93C5FD" : "2563EB", bg: dark ? "262626" : "FFFFFF", size: 10.5 },
  };
  // Content status/tag colors are font-only on every worksheet, including
  // static previews. Section headers and completed-card shading stay intact.
  for (const tone of [
    "paid",
    "pending",
    "partial",
    "sky",
    "violet",
    "amber",
    "tagGreen",
    "tagSky",
    "tagAmber",
    "tagViolet",
    "label",
  ] as const)
    looks[tone].bg = colors.body;
  const tones = Object.keys(looks) as SheetTone[],
    font = (tone: SheetTone, colorTone = tone, size?: number, family = "Arial") => {
      const look = looks[tone];
      return `<font><name val="${xml(family)}"/><b val="${look.bold ? 1 : 0}"/>${look.underline ? '<u val="single"/>' : ""}<sz val="${size ?? look.size ?? 11}"/><color rgb="FF${looks[colorTone].fg}"/></font>`;
    };
  // Reserve font zero for Normal. Give every explicitly styled cell a
  // non-zero font ID, including the plain numeric/formula cells. Importers
  // that treat fontId=0 as the application default must not turn them black.
  const fontDefinitions = ['<font><name val="Arial"/><sz val="10"/><scheme val="minor"/></font>'];
  const fontMap = new Map<string, number>();
  const fontIndex = (tone: SheetTone, colorTone?: SheetTone, size?: number, family?: string) => {
    const key = font(tone, colorTone, size, family);
    if (!fontMap.has(key)) {
      fontMap.set(key, fontDefinitions.length);
      fontDefinitions.push(key);
    }
    return fontMap.get(key)!;
  };
  const fills = `<fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>${tones.map((tone) => `<fill><patternFill patternType="solid"><fgColor rgb="FF${looks[tone].bg}"/><bgColor indexed="64"/></patternFill></fill>`).join("")}`;
  const edge = `<bottom style="hair"><color rgb="FF${colors.line}"/></bottom>`;
  const ledgerColor = dark ? "222222" : "E5E7EB";
  const ledgerEdge = `<bottom style="hair"><color rgb="FF${ledgerColor}"/></bottom>`;
  const borderDefinitions = [
    "<border/>",
    `<border>${edge}</border>`,
    `<border><right style="thin"><color rgb="FF${colors.line}"/></right>${edge}</border>`,
    `<border>${ledgerEdge}</border>`,
    `<border><right style="hair"><color rgb="FF${ledgerColor}"/></right>${ledgerEdge}</border>`,
  ];
  const borderMap = new Map<string, number>();
  const formats: string[] = [],
    formatMap = new Map<string, number>();
  const styleIndex: WorksheetStyleResolver = (
    tone,
    numFmt,
    right,
    {
      colorTone,
      size,
      borderColor,
      clearBorders = false,
      uniformBackground = false,
      family = "Arial",
      outlined = false,
      borderOverride,
    },
  ) => {
    const key = `${tone}:${numFmt}:${right}:${colorTone || ""}:${size ?? ""}:${borderColor || ""}:${clearBorders}:${uniformBackground}:${family}:${outlined}:${borderOverride?.color || ""}:${borderOverride?.edges.join(",") || ""}`;
    if (!formatMap.has(key)) {
      const n = tones.indexOf(tone);
      formatMap.set(key, formats.length);
      let border =
        clearBorders || tone === "canvas"
          ? 0
          : tone.startsWith("ledger")
            ? tone === "ledgerLabel"
              ? 4
              : 3
            : tone === "label"
              ? 2
              : 1;
      if (borderColor && border) {
        const borderKey = `${border}:${borderColor}`;
        if (!borderMap.has(borderKey)) {
          borderMap.set(borderKey, borderDefinitions.length);
          borderDefinitions.push(
            borderDefinitions[border].replace(/rgb="FF[0-9A-F]{6}"/g, `rgb="FF${borderColor}"`),
          );
        }
        border = borderMap.get(borderKey)!;
      }
      if (outlined || borderOverride) {
        const color = borderOverride?.color || looks[colorTone || tone].fg;
        const edges = borderOverride?.edges || ["left", "right", "top", "bottom"];
        const borderKey = `outline:${color}:${edges.join(",")}`;
        if (!borderMap.has(borderKey)) {
          borderMap.set(borderKey, borderDefinitions.length);
          borderDefinitions.push(
            `<border>${edges.map((edge) => `<${edge} style="thin"><color rgb="FF${color}"/></${edge}>`).join("")}</border>`,
          );
        }
        border = borderMap.get(borderKey)!;
      }
      const fill = (uniformBackground ? tones.indexOf("canvas") : n) + 2;
      formats.push(
        `<xf numFmtId="${numFmt}" fontId="${fontIndex(tone, colorTone, size, family)}" fillId="${fill}" borderId="${border}" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="${right === "center" ? "center" : right ? "right" : "left"}" vertical="center" wrapText="1" indent="${tone.startsWith("ledger") ? 0 : 1}"/></xf>`,
      );
    }
    return formatMap.get(key)!;
  };
  // Readers can fall back to Normal instead of the column style for unused
  // cells. Both must use the standard canvas, including in light exports.
  const normalFont = fontIndex("body"),
    normalFill = tones.indexOf("canvas") + 2;
  formats.push(
    `<xf numFmtId="0" fontId="${normalFont}" fillId="${normalFill}" borderId="0" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>`,
  );
  const overrides: string[] = [];
  let chartNumber = 0;
  workbook.SheetNames.forEach((name, sheetIndex) => {
    const sheet = workbook.Sheets[name],
      meta = appearance(sheet),
      path = `xl/worksheets/sheet${sheetIndex + 1}.xml`;
    let data = read(path);
    data = styleWorksheetCellsXml(data, sheet, meta, originalFormats, styleIndex);
    const blankStyle = meta.blankTone
      ? styleIndex(meta.blankTone, 0, false, {
          size: meta.fontSizes?.[meta.blankTone],
          borderColor: meta.borderColor,
          clearBorders: meta.clearBorders,
          uniformBackground: meta.uniformBackground,
          family: meta.fontFamily,
        })
      : undefined;
    data = layoutWorksheetXml(data, meta, blankStyle, tones);
    if (meta.charts.length) {
      const drawing = sheetIndex + 1;
      const sheetRelationsPath = `xl/worksheets/_rels/sheet${drawing}.xml.rels`;
      const existing = read(sheetRelationsPath);
      const drawingId = `rId${1 + Math.max(0, ...[...existing.matchAll(/\bId="rId(\d+)"/g)].map((match) => Number(match[1])))}`;
      const relation = `<Relationship Id="${drawingId}" Type="${rel}/drawing" Target="/xl/drawings/drawing${drawing}.xml"/>`;
      save(
        sheetRelationsPath,
        existing
          ? existing.replace("</Relationships>", `${relation}</Relationships>`)
          : `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="${packageRel}">${relation}</Relationships>`,
      );
      const drawingRelations: string[] = [];
      const anchors = meta.charts
        .map((chart, i) => {
          const number = ++chartNumber;
          const lightColor = (color: string) =>
            (
              ({
                FACC15: "A16207",
                "38BDF8": "0284C7",
                FB7185: "E11D48",
                A78BFA: "7C3AED",
                F59E0B: "B45309",
                "7DD3FC": "0369A1",
                "6EE7B7": "047857",
                FCD34D: "92400E",
                C4B5FD: "6D28D9",
              }) as Record<string, string>
            )[color] || color;
          const styledChart = dark
            ? chart
            : {
                ...chart,
                series: chart.series.map((item) => ({ ...item, color: lightColor(item.color) })),
                markers: chart.markers?.map((color) => (color ? lightColor(color) : null)),
              };
          save(`xl/charts/chart${number}.xml`, chartXml(styledChart, colors));
          overrides.push(
            `<Override PartName="/xl/charts/chart${number}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>`,
          );
          drawingRelations.push(
            `<Relationship Id="rId${i + 1}" Type="${rel}/chart" Target="/xl/charts/chart${number}.xml"/>`,
          );
          // Match the working Synology export: default drawing namespace,
          // oneCellAnchor and package-absolute chart/drawing relationships.
          return `<oneCellAnchor><from><col>${chart.column}</col><colOff>0</colOff><row>${chart.row}</row><rowOff>0</rowOff></from><ext cx="${chart.width * 9525}" cy="${chart.height * 9525}"/><graphicFrame><nvGraphicFramePr><cNvPr id="${i + 1}" name="${xml(chart.title)}"/><cNvGraphicFramePr/></nvGraphicFramePr><xfrm><a:off x="0" y="0"/><a:ext cx="${chart.width * 9525}" cy="${chart.height * 9525}"/></xfrm><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart"><c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:r="${rel}" r:id="rId${i + 1}"/></a:graphicData></a:graphic></graphicFrame><clientData/></oneCellAnchor>`;
        })
        .join("");
      save(
        `xl/drawings/drawing${drawing}.xml`,
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><wsDr xmlns="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">${anchors}</wsDr>`,
      );
      save(
        `xl/drawings/_rels/drawing${drawing}.xml.rels`,
        `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="${packageRel}">${drawingRelations.join("")}</Relationships>`,
      );
      overrides.push(
        `<Override PartName="/xl/drawings/drawing${drawing}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>`,
      );
      data = data.replace("</worksheet>", `<drawing r:id="${drawingId}"/></worksheet>`);
    }
    save(path, data);
  });
  const replace = (tag: string, children: string, count: number) => {
    styles = replaceSpreadsheetStyleCollection(styles, tag, children, count);
  };
  replace("fonts", fontDefinitions.join(""), fontDefinitions.length);
  replace("fills", fills, tones.length + 2);
  replace("borders", borderDefinitions.join(""), borderDefinitions.length);
  replace(
    "cellStyleXfs",
    `<xf numFmtId="0" fontId="${normalFont}" fillId="${normalFill}" borderId="0" applyFont="1" applyFill="1" applyBorder="1"/>`,
    1,
  );
  replace("cellXfs", formats.join(""), formats.length);
  // Differential styles leave fills untouched. Only bill status rules set
  // bold explicitly, so editing the status can both enable and remove it.
  replace(
    "dxfs",
    tones
      .map(
        (tone) =>
          `<dxf><font>${tone === "billPaid" ? '<b val="1"/>' : tone === "billStatus" ? '<b val="0"/>' : ""}<color rgb="FF${looks[tone].fg}"/></font></dxf>`,
      )
      .join(""),
    tones.length,
  );
  save("xl/styles.xml", styles);
  // An importer may use the workbook palette instead of a chart's explicit
  // series/text colors. Supply the same readable palette at both levels.
  let themeXml = read("xl/theme/theme1.xml");
  const themeColors: Record<string, string> = {
    dk1: colors.text,
    lt1: colors.background,
    dk2: colors.text,
    lt2: colors.body,
    accent1: dark ? "FACC15" : "A16207",
    accent2: dark ? "38BDF8" : "0284C7",
    accent3: dark ? "FB7185" : "E11D48",
    accent4: dark ? "A78BFA" : "7C3AED",
    accent5: dark ? "F59E0B" : "B45309",
    accent6: dark ? "6EE7B7" : "047857",
  };
  for (const [key, color] of Object.entries(themeColors))
    themeXml = themeXml.replace(
      new RegExp(`<a:${key}>[\\s\\S]*?</a:${key}>`),
      `<a:${key}><a:srgbClr val="${color}"/></a:${key}>`,
    );
  themeXml = themeXml.replace(/<a:latin typeface="[^"]*"\/>/g, '<a:latin typeface="Arial"/>');
  save("xl/theme/theme1.xml", themeXml);
  types = types.replace("</Types>", `${overrides.join("")}</Types>`);
  save("[Content_Types].xml", types);
  const bytes = zip.write(archive, { fileType: "zip", compression: true });
  const result = new Uint8Array(bytes.length);
  result.set(bytes);
  return result;
}
