const COSTA_RICA_TIME_ZONE = "America/Costa_Rica";
const COSTA_RICA_LOCALE = "es-CR";

const WEEKDAY_MAP: Record<string, string> = {
  sunday: "sunday",
  monday: "monday",
  tuesday: "tuesday",
  wednesday: "wednesday",
  thursday: "thursday",
  friday: "friday",
  saturday: "saturday",
};

type DateInput = Date | string | number;

function getFormatter(options: Intl.DateTimeFormatOptions, locale = COSTA_RICA_LOCALE) {
  return new Intl.DateTimeFormat(locale, {
    timeZone: COSTA_RICA_TIME_ZONE,
    ...options,
  });
}

function toDate(value: DateInput, treatAsDateOnly = false): Date {
  if (value instanceof Date) {
    return value;
  }

  if (typeof value === "number") {
    return new Date(value);
  }

  if (treatAsDateOnly && !value.includes("T")) {
    return new Date(`${value}T12:00:00Z`);
  }

  return new Date(value);
}

function getDateParts(value: DateInput = new Date()) {
  const parts = getFormatter(
    {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    },
    "en-CA"
  ).formatToParts(toDate(value));

  const year = parts.find((part) => part.type === "year")?.value ?? "0000";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";

  return { year, month, day };
}

export function getCostaRicaDateKey(value: DateInput = new Date()): string {
  const { year, month, day } = getDateParts(value);
  return `${year}-${month}-${day}`;
}

export function parseDateKeyAsUtc(dateKey: string): Date {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

export function getCostaRicaWeekdayKey(value: DateInput = new Date()): string {
  const weekday = getFormatter({ weekday: "long" }, "en-US")
    .format(toDate(value))
    .toLowerCase();

  return WEEKDAY_MAP[weekday] ?? "monday";
}

export function shiftDateKey(dateKey: string, amount: number): string {
  const date = parseDateKeyAsUtc(dateKey);
  date.setUTCDate(date.getUTCDate() + amount);
  return getCostaRicaDateKey(date);
}

export function getCostaRicaWeekStart(value: DateInput = new Date()): string {
  const dateKey = getCostaRicaDateKey(value);
  const weekday = getCostaRicaWeekdayKey(value);
  const offsetMap: Record<string, number> = {
    monday: 0,
    tuesday: 1,
    wednesday: 2,
    thursday: 3,
    friday: 4,
    saturday: 5,
    sunday: 6,
  };

  return shiftDateKey(dateKey, -(offsetMap[weekday] ?? 0));
}

export function shiftCostaRicaWeekStart(weekStart: string, amount: number): string {
  return shiftDateKey(weekStart, amount * 7);
}

export function getCostaRicaMonthStart(value: DateInput = new Date(), monthOffset = 0): Date {
  const { year, month } = getDateParts(value);
  return new Date(Date.UTC(Number(year), Number(month) - 1 + monthOffset, 1));
}

export function formatCostaRicaDate(
  value: DateInput,
  options: Intl.DateTimeFormatOptions,
  treatAsDateOnly = false
): string {
  return getFormatter(options).format(toDate(value, treatAsDateOnly));
}

export function formatCostaRicaDateTime(
  value: DateInput,
  options: Intl.DateTimeFormatOptions,
  treatAsDateOnly = false
): string {
  return getFormatter(options).format(toDate(value, treatAsDateOnly));
}

export { COSTA_RICA_LOCALE, COSTA_RICA_TIME_ZONE };