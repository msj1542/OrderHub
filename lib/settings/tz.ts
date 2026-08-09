/**
 * Business timezone utilities.
 *
 * The business timezone is stored in application_settings as 'business_timezone'
 * (defaults to process.env.BUSINESS_TIMEZONE for the first boot).
 */

export function formatInTz(date: Date, tz: string, opts?: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    ...opts,
  }).format(date);
}

/** Return `date`'s calendar date string (YYYY-MM-DD) as observed in `tz`. */
export function dateStrInTz(date: Date, tz: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Return the current date string (YYYY-MM-DD) in the business timezone. */
export function todayInTz(tz: string): string {
  return dateStrInTz(new Date(), tz);
}

export type LocalWallTime = { weekday: string; hour: number; minute: number };

/**
 * Wall-clock weekday/hour/minute for `date` as observed in `tz`. Shared by
 * every call site that needs "what weekday/time is it right now, in the
 * business timezone" (the cutoff countdown, expected-completion calc, and
 * expedited-date window calc all needed exactly this and previously each
 * reimplemented it independently).
 */
export function getLocalWallTime(date: Date, tz: string): LocalWallTime {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "long",
    hour: "numeric",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return {
    weekday: get("weekday") || "Monday",
    hour: Number(get("hour")) || 0,
    minute: Number(get("minute")) || 0,
  };
}

/** Parse a YYYY-MM-DD string into a Date at midnight UTC. */
export function parseDateStr(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00Z`);
}

/** Format a Date as YYYY-MM-DD. */
export function toDateStr(date: Date): string {
  return date.toISOString().slice(0, 10);
}
