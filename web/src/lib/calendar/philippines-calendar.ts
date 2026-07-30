export type PhilippinesHoliday = {
  date: string;
  name: string;
  source: "official-2026" | "calendar-api" | "calculated-fallback";
};

type HolidayApiRow = {
  date?: unknown;
  name?: unknown;
  nationalHoliday?: unknown;
  holidayTypes?: unknown;
};

const OFFICIAL_2026_HOLIDAYS: PhilippinesHoliday[] = [
  ["2026-01-01", "New Year's Day"],
  ["2026-02-17", "Chinese New Year"],
  ["2026-03-20", "Eid'l Fitr"],
  ["2026-04-02", "Maundy Thursday"],
  ["2026-04-03", "Good Friday"],
  ["2026-04-04", "Black Saturday"],
  ["2026-04-09", "Araw ng Kagitingan"],
  ["2026-05-01", "Labor Day"],
  ["2026-05-27", "Eid'l Adha"],
  ["2026-06-12", "Independence Day"],
  ["2026-08-21", "Ninoy Aquino Day"],
  ["2026-08-31", "National Heroes Day"],
  ["2026-11-01", "All Saints' Day"],
  ["2026-11-02", "All Souls' Day"],
  ["2026-11-30", "Bonifacio Day"],
  ["2026-12-08", "Feast of the Immaculate Conception of Mary"],
  ["2026-12-24", "Christmas Eve"],
  ["2026-12-25", "Christmas Day"],
  ["2026-12-30", "Rizal Day"],
  ["2026-12-31", "Last Day of the Year"],
].map(([date, name]) => ({
  date,
  name,
  source: "official-2026",
}));

function isoDate(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function addUtcDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function toIsoDate(date: Date) {
  return isoDate(
    date.getUTCFullYear(),
    date.getUTCMonth() + 1,
    date.getUTCDate(),
  );
}

function easterSunday(year: number) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

function lastMondayOfAugust(year: number) {
  const date = new Date(Date.UTC(year, 7, 31));
  while (date.getUTCDay() !== 1) {
    date.setUTCDate(date.getUTCDate() - 1);
  }
  return toIsoDate(date);
}

export function calculatedPhilippineHolidays(
  year: number,
): PhilippinesHoliday[] {
  if (year === 2026) return OFFICIAL_2026_HOLIDAYS;

  const easter = easterSunday(year);
  const holidays: Array<[string, string]> = [
    [isoDate(year, 1, 1), "New Year's Day"],
    [toIsoDate(addUtcDays(easter, -3)), "Maundy Thursday"],
    [toIsoDate(addUtcDays(easter, -2)), "Good Friday"],
    [toIsoDate(addUtcDays(easter, -1)), "Black Saturday"],
    [isoDate(year, 4, 9), "Araw ng Kagitingan"],
    [isoDate(year, 5, 1), "Labor Day"],
    [isoDate(year, 6, 12), "Independence Day"],
    [isoDate(year, 8, 21), "Ninoy Aquino Day"],
    [lastMondayOfAugust(year), "National Heroes Day"],
    [isoDate(year, 11, 1), "All Saints' Day"],
    [isoDate(year, 11, 30), "Bonifacio Day"],
    [isoDate(year, 12, 8), "Feast of the Immaculate Conception of Mary"],
    [isoDate(year, 12, 25), "Christmas Day"],
    [isoDate(year, 12, 30), "Rizal Day"],
    [isoDate(year, 12, 31), "Last Day of the Year"],
  ];
  return holidays.map(([date, name]) => ({
    date,
    name,
    source: "calculated-fallback",
  }));
}

function cacheKey(year: number) {
  return `ekampusmo:ph-national-holidays:${year}:v1`;
}

function readCachedYear(year: number) {
  if (typeof window === "undefined") return null;
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(cacheKey(year)) ?? "null",
    ) as PhilippinesHoliday[] | null;
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : null;
  } catch {
    return null;
  }
}

function writeCachedYear(year: number, holidays: PhilippinesHoliday[]) {
  window.localStorage.setItem(cacheKey(year), JSON.stringify(holidays));
}

async function loadHolidayYear(year: number) {
  if (year === 2026) return OFFICIAL_2026_HOLIDAYS;
  const cached = readCachedYear(year);
  if (cached) return cached;

  try {
    const response = await fetch(
      `https://nagerholidays.com/api/v4/Holidays/PH/${year}`,
    );
    if (!response.ok) throw new Error("Holiday calendar request failed.");
    const rows = (await response.json()) as HolidayApiRow[];
    const holidays = rows
      .filter(
        (row) =>
          row.nationalHoliday === true &&
          Array.isArray(row.holidayTypes) &&
          row.holidayTypes.includes("Public") &&
          typeof row.date === "string" &&
          typeof row.name === "string",
      )
      .map((row) => ({
        date: String(row.date),
        name: String(row.name),
        source: "calendar-api" as const,
      }));
    if (holidays.length === 0) {
      throw new Error("No nationwide holidays were returned.");
    }
    writeCachedYear(year, holidays);
    return holidays;
  } catch {
    return calculatedPhilippineHolidays(year);
  }
}

export async function loadPhilippineHolidays(years: number[]) {
  const results = await Promise.all(
    Array.from(new Set(years)).map(loadHolidayYear),
  );
  const byDate = new Map<string, PhilippinesHoliday>();
  results.flat().forEach((holiday) => byDate.set(holiday.date, holiday));
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function isWeekendDate(date: string) {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return day === 0 || day === 6;
}

export function addCalendarDays(date: string, days: number) {
  return toIsoDate(addUtcDays(new Date(`${date}T00:00:00Z`), days));
}

export function calculateInternshipExpectedEnd({
  startDate,
  requiredMinutes,
  dailyMinutes,
  holidays,
  absenceDates,
}: {
  startDate: string;
  requiredMinutes: number;
  dailyMinutes: number;
  holidays: PhilippinesHoliday[];
  absenceDates: string[];
}) {
  if (
    !startDate ||
    !Number.isFinite(requiredMinutes) ||
    requiredMinutes <= 0 ||
    !Number.isFinite(dailyMinutes) ||
    dailyMinutes <= 0
  ) {
    return null;
  }

  const holidayDates = new Set(holidays.map((holiday) => holiday.date));
  const recordedAbsences = new Set(absenceDates);
  let remainingMinutes = requiredMinutes;
  let cursor = startDate;
  let expectedEndDate: string | null = null;
  let workdays = 0;
  let weekendsSkipped = 0;
  let holidaysSkipped = 0;
  let absencesSkipped = 0;

  for (
    let checkedDays = 0;
    checkedDays < 3660 && remainingMinutes > 0;
    checkedDays += 1
  ) {
    if (isWeekendDate(cursor)) {
      weekendsSkipped += 1;
    } else if (holidayDates.has(cursor)) {
      holidaysSkipped += 1;
    } else if (recordedAbsences.has(cursor)) {
      absencesSkipped += 1;
    } else {
      remainingMinutes -= dailyMinutes;
      workdays += 1;
      expectedEndDate = cursor;
    }
    cursor = addCalendarDays(cursor, 1);
  }

  if (remainingMinutes > 0 || !expectedEndDate) return null;

  return {
    expectedEndDate,
    workdays,
    weekendsSkipped,
    holidaysSkipped,
    absencesSkipped,
  };
}
