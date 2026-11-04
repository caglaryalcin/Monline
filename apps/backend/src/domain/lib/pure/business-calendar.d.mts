export interface BusinessCalendar { country?: string; region?: string }
export interface HolidayLocation { code: string; name: string }
export function holidayCountries(language?: string): HolidayLocation[];
export function holidayRegions(country: string, language?: string): HolidayLocation[];
export function normalizeBusinessCalendar(value?: BusinessCalendar | null): { country: string; region: string };
export function isCalendarHoliday(day: string, value?: BusinessCalendar | null): boolean;
