import { utils } from "xlsx";

import type { SheetAppearance, SheetTone } from "./spreadsheetAppearance";
import { escapeSpreadsheetXml as xml } from "./spreadsheetXml";

/** Apply worksheet layout independently from values, formulas and chart packaging. */
export function layoutWorksheetXml(
  data: string,
  meta: SheetAppearance,
  blankStyle: number | undefined,
  tones: SheetTone[],
) {
  if (blankStyle !== undefined) {
    // Column styles cover the unused sheet without materializing a million
    // empty rows. Explicit data cell styles keep their own formatting.
    let lastColumn = 0;
    const columnBlock = data.match(/<cols(?:\s*\/>|>([\s\S]*?)<\/cols>)/);
    const columns = (columnBlock?.[1] || "").replace(
      /<col\b([^>]*?)\/>/g,
      (_tag, attributes: string) => {
        const max = attributes.match(/\bmax="(\d+)"/)?.[1];
        // An incomplete imported column cannot define a usable range.
        if (!max) return "";
        lastColumn = Math.max(lastColumn, Number(max));
        return `<col${attributes.replace(/\s+style="\d+"/, "")} style="${blankStyle}"/>`;
      },
    );
    const remainder =
      lastColumn < 16384 ? `<col min="${lastColumn + 1}" max="16384" style="${blankStyle}"/>` : "";
    const replacement = `<cols>${columns}${remainder}</cols>`;
    data = columnBlock
      ? data.replace(columnBlock[0], replacement)
      : data.replace("<sheetData", `${replacement}<sheetData`);
  }
  const x = meta.freeze.column,
    y = meta.freeze.row,
    scrollColumn = meta.startColumn ?? x;
  const topLeft = utils.encode_cell({ r: y, c: scrollColumn });
  const pane = x && y ? "bottomRight" : y ? "bottomLeft" : "topRight";
  const start =
    meta.startColumn == null
      ? ""
      : ` topLeftCell="${utils.encode_cell({ r: 0, c: scrollColumn })}"`;
  const selected =
    meta.startColumn == null
      ? ""
      : `<selection${x || y ? ` pane="${pane}"` : ""} activeCell="${topLeft}" sqref="${topLeft}"/>`;
  const view = `<sheetViews><sheetView workbookViewId="0" showGridLines="0" zoomScale="${meta.zoom}"${start}>${x || y ? `<pane${x ? ` xSplit="${x}"` : ""}${y ? ` ySplit="${y}"` : ""} topLeftCell="${topLeft}" activePane="${pane}" state="frozen"/>` : ""}${selected}</sheetView></sheetViews>`;
  data = data.replace(/<sheetViews\b[\s\S]*?<\/sheetViews>/, view);
  const properties = `<sheetPr><tabColor rgb="FF${meta.tab}"/><outlinePr summaryBelow="1"/><pageSetUpPr fitToPage="1"/></sheetPr>`;
  data = /<sheetPr\b/.test(data)
    ? data.replace(/<sheetPr\b[^>]*(?:\/>|>[\s\S]*?<\/sheetPr>)/, properties)
    : data.replace(/(<worksheet\b[^>]*>)/, `$1${properties}`);
  data = /<sheetFormatPr\b/.test(data)
    ? data.replace(/<sheetFormatPr\b[^>]*\/>/, '<sheetFormatPr defaultRowHeight="24"/>')
    : data.replace("</sheetViews>", '</sheetViews><sheetFormatPr defaultRowHeight="24"/>');
  const rules = meta.rules
    .map(
      (rule, i) =>
        `<conditionalFormatting sqref="${xml(rule.range)}"><cfRule type="expression" dxfId="${tones.indexOf(rule.tone)}" priority="${i + 1}" stopIfTrue="1"><formula>${xml(rule.formula)}</formula></cfRule></conditionalFormatting>`,
    )
    .join("");
  if (rules) {
    const before = data.search(
      /<(?:dataValidations|hyperlinks|printOptions|pageMargins|pageSetup|headerFooter|ignoredErrors|drawing|extLst)\b/,
    );
    data =
      before < 0
        ? data.replace("</worksheet>", `${rules}</worksheet>`)
        : data.slice(0, before) + rules + data.slice(before);
  }
  data = data.replace(
    /<pageMargins\b[^>]*\/>/,
    '<pageMargins left="0.25" right="0.25" top="0.35" bottom="0.35" header="0.15" footer="0.15"/>',
  );
  if (!/<pageSetup\b/.test(data)) {
    const setup =
      '<pageSetup orientation="landscape" paperSize="9" fitToWidth="1" fitToHeight="0"/>';
    const before = data.search(
      /<(?:headerFooter|rowBreaks|colBreaks|customProperties|cellWatches|ignoredErrors|smartTags|drawing|extLst)\b/,
    );
    data =
      before < 0
        ? data.replace("</worksheet>", `${setup}</worksheet>`)
        : data.slice(0, before) + setup + data.slice(before);
  }
  return data;
}
