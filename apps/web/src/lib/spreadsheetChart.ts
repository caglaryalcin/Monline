import type { SheetChart } from "./spreadsheetAppearance";
import { escapeSpreadsheetXml as xml } from "./spreadsheetXml";

interface ChartColors {
  background: string;
  text: string;
}

const CATEGORY_AXIS_ID = 100;
const VALUE_AXIS_ID = 200;
// Apply at series and chart-group levels; removing this node is not equivalent
// to disabling labels in every reader. Some importers still discard this flag.
const LABELS_OFF = '<c:dLbls><c:delete val="1"/></c:dLbls>';

function solid(color: string) {
  return `<a:solidFill><a:srgbClr val="${color}"/></a:solidFill>`;
}

function cache(values: (number | string | null)[], numeric = false, format = "General") {
  const tag = numeric ? "numCache" : "strCache";
  return [
    `<c:${tag}>`,
    numeric ? `<c:formatCode>${xml(format)}</c:formatCode>` : "",
    `<c:ptCount val="${values.length}"/>`,
    values
      .map((value, index) =>
        value == null ? "" : `<c:pt idx="${index}"><c:v>${xml(value)}</c:v></c:pt>`,
      )
      .join(""),
    `</c:${tag}>`,
  ].join("");
}

function textStyle(color: string) {
  const font = `${solid(color)}<a:latin typeface="Arial"/>`;
  return [
    "<c:txPr><a:bodyPr/><a:lstStyle/><a:p>",
    `<a:pPr><a:defRPr sz="1200">${font}</a:defRPr></a:pPr>`,
    `<a:endParaRPr lang="en-US" sz="1200">${font}</a:endParaRPr>`,
    "</a:p></c:txPr>",
  ].join("");
}

function marker(color: string, size: number) {
  return `<c:marker><c:symbol val="circle"/><c:size val="${size}"/><c:spPr>${solid(color)}<a:ln><a:noFill/></a:ln></c:spPr></c:marker>`;
}

function seriesXml(chart: SheetChart, item: SheetChart["series"][number], index: number) {
  const title = item.nameRange
    ? `<c:tx><c:strRef><c:f>${xml(item.nameRange)}</c:f>${cache([item.name])}</c:strRef></c:tx>`
    : `<c:tx><c:v>${xml(item.name)}</c:v></c:tx>`;
  const taggedPoints = (chart.markers || [])
    .map((color, pointIndex) =>
      color ? `<c:dPt><c:idx val="${pointIndex}"/>${marker(color, 6)}<c:spPr/></c:dPt>` : "",
    )
    .join("");
  // Year labels use string categories; all monthly values stay independent.
  const categories = `<c:cat><c:strRef><c:f>${xml(chart.categories)}</c:f>${cache(chart.axisLabels || chart.labels)}</c:strRef></c:cat>`;
  return [
    `<c:ser><c:idx val="${index}"/><c:order val="${index}"/>`,
    title,
    `<c:spPr>${solid(item.color)}<a:ln w="19050">${solid(item.color)}<a:prstDash val="solid"/></a:ln></c:spPr>`,
    marker(item.color, 4),
    taggedPoints,
    LABELS_OFF,
    categories,
    `<c:val><c:numRef><c:f>${xml(item.range)}</c:f>${cache(item.values, true, item.format)}</c:numRef></c:val>`,
    '<c:smooth val="0"/></c:ser>',
  ].join("");
}

function axesXml(chart: SheetChart, text: string) {
  const labelSkip = chart.axisLabels ? 1 : Math.max(1, Math.ceil(chart.labels.length / 12));
  const ticksOff = '<c:majorTickMark val="none"/><c:minorTickMark val="none"/>';
  // No major/minorGridlines nodes: neither axis draws a grid.
  return [
    `<c:catAx><c:axId val="${CATEGORY_AXIS_ID}"/>`,
    '<c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="b"/>',
    '<c:numFmt formatCode="General" sourceLinked="1"/>',
    ticksOff,
    '<c:tickLblPos val="nextTo"/>',
    text,
    `<c:crossAx val="${VALUE_AXIS_ID}"/><c:crosses val="autoZero"/><c:auto val="1"/><c:lblAlgn val="ctr"/><c:lblOffset val="100"/>`,
    `<c:tickLblSkip val="${labelSkip}"/><c:noMultiLvlLbl val="1"/></c:catAx>`,
    `<c:valAx><c:axId val="${VALUE_AXIS_ID}"/>`,
    '<c:scaling><c:orientation val="minMax"/><c:min val="0"/></c:scaling><c:delete val="0"/><c:axPos val="l"/>',
    `<c:numFmt formatCode="${chart.multiple ? "&quot;x&quot;0.0" : "#,##0"}" sourceLinked="0"/>`,
    ticksOff,
    '<c:tickLblPos val="none"/>',
    text,
    `<c:crossAx val="${CATEGORY_AXIS_ID}"/><c:crosses val="autoZero"/><c:crossBetween val="between"/></c:valAx>`,
  ].join("");
}

/** Native editable charts: source formulas and caches must both be retained. */
export function chartXml(chart: SheetChart, colors: ChartColors) {
  const text = textStyle(colors.text);
  const background = `<c:spPr>${solid(colors.background)}<a:ln><a:noFill/></a:ln></c:spPr>`;
  return [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">',
    '<c:date1904 val="0"/><c:lang val="en-US"/><c:roundedCorners val="0"/><c:style val="2"/>',
    '<c:chart><c:autoTitleDeleted val="1"/><c:plotArea><c:layout/>',
    '<c:lineChart><c:grouping val="standard"/><c:varyColors val="0"/>',
    chart.series.map((item, index) => seriesXml(chart, item, index)).join(""),
    LABELS_OFF,
    `<c:marker val="1"/><c:smooth val="0"/><c:axId val="${CATEGORY_AXIS_ID}"/><c:axId val="${VALUE_AXIS_ID}"/></c:lineChart>`,
    axesXml(chart, text),
    background,
    '</c:plotArea><c:legend><c:legendPos val="t"/><c:overlay val="0"/>',
    text,
    '</c:legend><c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/></c:chart>',
    background,
    text,
    "</c:chartSpace>",
  ].join("");
}
