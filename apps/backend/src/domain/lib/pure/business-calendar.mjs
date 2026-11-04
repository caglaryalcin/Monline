import Holidays from "date-holidays";

const directory = new Holidays();
const calendars = new Map();
const years = new Map();

export function holidayCountries(language = "en") {
  const locale = language.replace(/_/g, "-");
  const names = new Intl.DisplayNames([locale], { type: "region" });
  return Object.entries(directory.getCountries(language.split(/[-_]/)[0]) || {})
    .map(([code, name]) => ({ code, name: names.of(code) || name }))
    .sort((a, b) => a.name.localeCompare(b.name, locale));
}

export function holidayRegions(country, language = "en") {
  if (!country) return [];
  const locale = language.replace(/_/g, "-");
  language = language.split(/[-_]/)[0];
  return Object.entries(directory.getStates(country, language) || {})
    .flatMap(([state, name]) => [
      { code: state, name },
      ...Object.entries(directory.getRegions(country, state, language) || {})
        .map(([region, label]) => ({ code: `${state}/${region}`, name: `${name} / ${label}` })),
    ])
    .sort((a, b) => a.name.localeCompare(b.name, locale));
}

export function normalizeBusinessCalendar(value = {}) {
  const country = String(value?.country || "").trim().toUpperCase();
  const region = String(value?.region || "").trim();
  if ((!country && region) || (country && !Object.hasOwn(directory.getCountries(), country)) ||
      (region && !holidayRegions(country).some((item) => item.code === region)))
    throw new Error("holiday_calendar_invalid");
  return { country, region };
}

function calendarFor(value) {
  if (!value?.country) return null;
  const key = `${value.country}/${value.region || ""}`;
  if (!calendars.has(key)) {
    const { country, region } = normalizeBusinessCalendar(value);
    const [state, locality] = region.split("/");
    const calendar = new Holidays(country, state || undefined, locality || undefined, {
      types: ["public", "bank"],
    });
    if (calendars.size >= 64) calendars.delete(calendars.keys().next().value);
    calendars.set(key, calendar);
  }
  return calendars.get(key);
}

function localDay(date, formatter) {
  const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

/** Public/bank closures include partial days and every day of multi-day holidays. */
export function isCalendarHoliday(day, value) {
  const calendar = calendarFor(value);
  if (!calendar) return false;
  const year = Number(day.slice(0, 4));
  const key = `${value.country}/${value.region || ""}/${year}`;
  if (!years.has(key)) {
    const dates = new Set();
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: calendar.getTimezones()[0] || "UTC", year: "numeric", month: "2-digit", day: "2-digit",
    });
    for (const holiday of calendar.getHolidays(year)) {
      const first = localDay(holiday.start, formatter);
      const last = localDay(new Date(holiday.end.getTime() - 1), formatter);
      const cursor = new Date(`${first}T12:00:00Z`);
      for (let count = 0; count < 370 && cursor.toISOString().slice(0, 10) <= last; count++) {
        dates.add(cursor.toISOString().slice(0, 10));
        cursor.setUTCDate(cursor.getUTCDate() + 1);
      }
    }
    if (years.size >= 256) years.delete(years.keys().next().value);
    years.set(key, dates);
  }
  return years.get(key).has(day);
}
