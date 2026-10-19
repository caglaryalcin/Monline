export function isValidISODate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function displayDateInput(value: string) {
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return iso ? `${iso[3]}/${iso[2]}/${iso[1]}` : value;
}

export function parseDateInput(value: string) {
  const date = /^(\d{2})[./-]?(\d{2})[./-]?(\d{4})$/.exec(value);
  return date ? `${date[3]}-${date[2]}-${date[1]}` : value;
}
