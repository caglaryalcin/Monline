function normalize(value: string) {
  return value
    .trim()
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i");
}

export function matchesCalendarSearch(name: string, searchTerm: string) {
  return normalize(name).includes(normalize(searchTerm));
}
