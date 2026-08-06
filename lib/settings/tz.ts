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

/** Return the current date string (YYYY-MM-DD) in the business timezone. */
export function todayInTz(tz: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Parse a YYYY-MM-DD string into a Date at midnight UTC. */
export function parseDateStr(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00Z`);
}

/** Format a Date as YYYY-MM-DD. */
export function toDateStr(date: Date): string {
  return date.toISOString().slice(0, 10);
}
