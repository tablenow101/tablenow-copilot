const dateTimeFormatters = new Map<string, Intl.DateTimeFormat>();

export function restaurantLocalToIso(value: string, timeZone: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) throw new Error("Date et heure invalides.");
  const [, year, month, day, hour, minute] = match;
  const target = Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute));
  let offset = timeZoneOffset(new Date(target), timeZone);
  let instant = target - offset;
  const correctedOffset = timeZoneOffset(new Date(instant), timeZone);
  if (correctedOffset !== offset) {
    offset = correctedOffset;
    instant = target - offset;
  }
  const result = new Date(instant);
  if (formatLocalDateTime(result, timeZone) !== value) throw new Error("Cette heure locale n’existe pas dans le fuseau choisi.");
  return result.toISOString();
}

export function nextServiceLocal(timeZone: string, now = new Date()): string {
  const today = dateParts(now, timeZone);
  let value = `${today.year}-${today.month}-${today.day}T19:30`;
  if (new Date(restaurantLocalToIso(value, timeZone)) <= now) {
    const next = new Date(Date.UTC(Number(today.year), Number(today.month) - 1, Number(today.day) + 1, 12));
    value = `${next.getUTCFullYear()}-${two(next.getUTCMonth() + 1)}-${two(next.getUTCDate())}T19:30`;
  }
  return value;
}

export function addLocalHours(value: string, hours: number): string {
  const date = new Date(`${value}:00.000Z`);
  if (Number.isNaN(date.getTime())) return value;
  date.setUTCHours(date.getUTCHours() + hours);
  return date.toISOString().slice(0, 16);
}

export function formatRestaurantTime(value: string, timeZone: string): string {
  return new Intl.DateTimeFormat("fr-FR", { timeZone, hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

export function formatRestaurantDate(value: string, timeZone: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Intl.DateTimeFormat("fr-FR", { timeZone: "UTC", day: "2-digit", month: "short" }).format(new Date(`${value}T12:00:00.000Z`));
  }
  return new Intl.DateTimeFormat("fr-FR", { timeZone, day: "2-digit", month: "short" }).format(new Date(value));
}

function timeZoneOffset(date: Date, timeZone: string): number {
  const parts = dateParts(date, timeZone);
  return Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second)) - date.getTime();
}

function formatLocalDateTime(date: Date, timeZone: string): string {
  const parts = dateParts(date, timeZone);
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

function dateParts(date: Date, timeZone: string): Record<"year" | "month" | "day" | "hour" | "minute" | "second", string> {
  let formatter = dateTimeFormatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    dateTimeFormatters.set(timeZone, formatter);
  }
  const values = Object.fromEntries(formatter.formatToParts(date).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  return values as Record<"year" | "month" | "day" | "hour" | "minute" | "second", string>;
}

function two(value: number): string { return String(value).padStart(2, "0"); }
