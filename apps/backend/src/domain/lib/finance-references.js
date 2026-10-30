const { httpClient } = require("../../runtime.cjs");
const finance = require("./pure/finance.js");
const CSGB = "https://www.csgb.gov.tr/yayinlar/calisma-hayati-istatistikleri-e-bulteni/eylul-2026/ucret-ve-sendikal-istatistikler.html";
const rateCache = new Map();
let wageCache = null;
let wageRequest = null;

function today() {
  const parts = new Intl.DateTimeFormat("en", { timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  return ["year", "month", "day"].map((type) => parts.find((part) => part.type === type).value).join("-");
}
function rateForDay(day, asOf) {
  const cached = rateCache.get(day);
  if (cached && cached.expires > Date.now()) return cached.promise;
  const [y, m, d] = day.split("-");
  const entry = { expires: Date.now() + (day === asOf ? 300000 : 86400000) };
  entry.promise = httpClient.send({ url: `https://www.tcmb.gov.tr/kurlar/${y}${m}/${d}${m}${y}.xml`, timeout: 12, maxBytes: 200000 })
    .then((response) => {
      const result = response.statusCode === 200 ? finance.parseRates(response.raw) : null;
      if (!result || result.rate_date > day || result.rate_date > asOf) {
        if (rateCache.get(day) === entry) rateCache.delete(day);
        return null;
      }
      return result;
    }).catch((error) => {
      if (rateCache.get(day) === entry) rateCache.delete(day);
      throw error;
    });
  rateCache.set(day, entry);
  // Bound the public-data cache independently of the number of accounts.
  if (rateCache.size > 500) rateCache.delete(rateCache.keys().next().value);
  return entry.promise;
}
async function fetchRates(month, asOf) {
  const days = finance.rateDates(month, asOf).filter((day) => ![0, 6].includes(new Date(`${day}T12:00:00Z`).getUTCDay()));
  for (let index = 0; index < days.length; index += 3) {
    const results = await Promise.allSettled(days.slice(index, index + 3).map((day) => rateForDay(day, asOf)));
    const valid = results.filter((result) => result.status === "fulfilled" && result.value).map((result) => result.value)
      .sort((a, b) => b.rate_date.localeCompare(a.rate_date));
    if (valid.length) return valid[0];
  }
  return null;
}
async function fetchMinimumWage(month, asOf) {
  try {
    if (!wageCache || wageCache.expires <= Date.now()) {
      if (!wageRequest) wageRequest = httpClient.send({ url: CSGB, timeout: 15, maxBytes: 2000000 })
        .then((response) => {
          if (response.statusCode !== 200) throw new Error("Wage source unavailable");
          wageCache = { raw: response.raw, expires: Date.now() + 43200000 };
        }).finally(() => { wageRequest = null; });
      await wageRequest;
    }
    const [year, number] = month.split("-").map(Number);
    const date = month === asOf.slice(0, 7) ? asOf : `${month}-${new Date(Date.UTC(year, number, 0)).getUTCDate()}`;
    const value = finance.minimumWage(wageCache.raw, date);
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}
module.exports = { today, fetchRates, fetchMinimumWage };
