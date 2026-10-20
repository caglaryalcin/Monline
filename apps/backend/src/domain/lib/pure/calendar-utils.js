function buildMonthRange(month, year) {
  const startDate = year + "-" + String(month).padStart(2, "0") + "-01";
  const endMonth = month === 12 ? 1 : month + 1;
  const endYear = month === 12 ? year + 1 : year;
  const endDate = endYear + "-" + String(endMonth).padStart(2, "0") + "-01";
  return {
    startDate,
    endDate,
  };
}
function formatIcalDate(dateValue) {
  const date = new Date(dateValue);
  const iso = date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  return iso.substring(0, 8);
}
function escapeIcalText(value) {
  return String(value)
    .replace(/\\/g, "\\\\")
    .replace(/\r\n|\r|\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
}
function foldIcalLine(line) {
  let result = "";
  let bytes = 0;
  for (const character of line) {
    const size = Buffer.byteLength(character, "utf8");
    if (bytes + size > 75) {
      result += "\r\n ";
      bytes = 1;
    }
    result += character;
    bytes += size;
  }
  return result;
}
function buildIcalEvent(event) {
  const dateStr = formatIcalDate(event.nextPayment);
  return (
    [
      "BEGIN:VEVENT",
      "UID:" + event.id + "@monline",
      "DTSTART;VALUE=DATE:" + dateStr,
      "DTEND;VALUE=DATE:" + dateStr,
      "SUMMARY:" +
        escapeIcalText(event.name + " - " + event.currencySymbol + event.price),
      "DESCRIPTION:" + escapeIcalText("Payment due for " + event.name),
      "END:VEVENT",
    ]
      .map(foldIcalLine)
      .join("\r\n") + "\r\n"
  );
}
module.exports = {
  buildMonthRange,
  formatIcalDate,
  buildIcalEvent,
};
