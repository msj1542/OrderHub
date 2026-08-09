/**
 * Pure schedule/rush-fee calculations — no database import, safe to use
 * from both server code and client components (e.g. the New Order form's
 * live rush-fee preview). Keep this file free of any "@/lib/db" import;
 * getSettings() (which does read the database) lives in schedule.ts.
 */

import { getLocalWallTime } from "./tz";

export type AppSettings = {
  businessTimezone:    string;
  rushFeeMode:         "percentage" | "flat" | "disabled" | "tiered";
  rushFeeValue:        number;
  /** Tiered mode: fee % applied at 1 business day out (the most urgent slot). */
  rushFeeTierMaxPercent: number;
  /** Tiered mode: fee % applied at the last valid business day before the normal completion date. */
  rushFeeTierMinPercent: number;
  cutoffWeekday:       string;
  cutoffTime:          string;
  completionWeekday:   string;
  completionTime:      string;
  /**
   * Disambiguates the cutoff→completion cycle when completionWeekday falls
   * on/before cutoffWeekday in simple weekday order (e.g. cutoff=Monday,
   * completion=Tuesday is ambiguous between "next-day" and "8 days later" —
   * this makes it explicit). "same" = completion happens within the same
   * cutoff-to-cutoff week; "next" = completion is pushed one additional week out.
   */
  completionWeekOffset: "same" | "next";
  duplicateWindowDays: number;
  labelWidthIn:        number;
  labelHeightIn:        number;
};

const WEEKDAY_INDEX: Record<string, number> = {
  Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3,
  Thursday: 4, Friday: 5, Saturday: 6,
};

function isWeekendDow(dow: number): boolean {
  return dow === 0 || dow === 6;
}

/**
 * Days from `nowDayIdx`/`nowMinutes` (local weekday + minutes-of-day) to the
 * expected completion date, per the cutoff/completion schedule. Pure
 * day-of-week arithmetic — no calendar dates involved — so it can be reused
 * both for the real "now" and for schedule-only simulation (see
 * computeFixedMaxLeadDays below).
 *
 * Rule:
 *   - Placed on/before cutoff weekday+time → completed that cycle's
 *     completion weekday+time (same week, or the following week if
 *     completionWeekOffset is "next").
 *   - Placed after cutoff → completed one full cycle later.
 */
function expectedCompletionDaysOut(
  settings: Pick<AppSettings, "cutoffWeekday" | "cutoffTime" | "completionWeekday" | "completionWeekOffset">,
  nowDayIdx: number,
  nowMinutes: number,
): number {
  const [cutoffH, cutoffM] = settings.cutoffTime.split(":").map(Number);
  const cutoffMinutes = cutoffH * 60 + (cutoffM ?? 0);

  const cutoffDayIdx     = WEEKDAY_INDEX[settings.cutoffWeekday]    ?? 1; // Mon
  const completionDayIdx = WEEKDAY_INDEX[settings.completionWeekday] ?? 5; // Fri

  const daysSinceCutoff = (nowDayIdx - cutoffDayIdx + 7) % 7;

  const weekOffsetDays = settings.completionWeekOffset === "next" ? 7 : 0;
  const cutoffToCompletionDays = ((completionDayIdx - cutoffDayIdx + 7) % 7) + weekOffsetDays;
  const daysToThisWeeksCompletion = cutoffToCompletionDays - daysSinceCutoff;

  const pastCutoff =
    daysSinceCutoff > 0 ||
    (daysSinceCutoff === 0 && nowMinutes > cutoffMinutes);

  let daysToTarget = daysToThisWeeksCompletion;
  if (pastCutoff) daysToTarget += 7;
  return daysToTarget;
}

/**
 * Compute the expected completion date for an order placed at `now`.
 * Returns a YYYY-MM-DD string.
 */
export function computeExpectedCompletion(settings: AppSettings, now: Date): string {
  const tz = settings.businessTimezone;

  const { weekday: localWeekday, hour: localHour, minute: localMinute } = getLocalWallTime(now, tz);
  const localMinutes = localHour * 60 + localMinute;
  const nowDayIdx     = WEEKDAY_INDEX[localWeekday] ?? 1;

  const daysToTarget = expectedCompletionDaysOut(settings, nowDayIdx, localMinutes);

  const completionDate = new Date(now);
  completionDate.setUTCDate(completionDate.getUTCDate() + daysToTarget);
  return completionDate.toISOString().slice(0, 10);
}

// ── Business-day date helpers ────────────────────────────────
//
// Dates below are plain YYYY-MM-DD calendar strings (matching how
// requestedDate/expectedCompletionDate are stored) manipulated via
// Date.UTC, the same convention computeExpectedCompletion() already
// uses for its own output — kept consistent rather than introducing a
// second date-handling approach.

function parseDateOnly(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function toDateOnlyString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function isWeekendDate(d: Date): boolean {
  return isWeekendDow(d.getUTCDay());
}

/** True if `dateStr` (YYYY-MM-DD) falls on a Saturday or Sunday. */
export function isWeekendDateString(dateStr: string): boolean {
  return isWeekendDate(parseDateOnly(dateStr));
}

/**
 * Count business days (Mon-Fri) strictly after `fromDateStr` through and
 * including `toDateStr`. E.g. Thursday -> the following Tuesday = 3
 * (Fri, Mon, Tue) — the intervening weekend doesn't count.
 */
export function businessDaysBetween(fromDateStr: string, toDateStr: string): number {
  const from = parseDateOnly(fromDateStr);
  const to   = parseDateOnly(toDateStr);
  if (to <= from) return 0;
  let count = 0;
  const cursor = new Date(from);
  while (cursor < to) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    if (!isWeekendDate(cursor)) count++;
  }
  return count;
}

/** The nearest business day strictly after `dateStr` (skips weekends). */
export function firstBusinessDayAfter(dateStr: string): string {
  const d = parseDateOnly(dateStr);
  do {
    d.setUTCDate(d.getUTCDate() + 1);
  } while (isWeekendDate(d));
  return toDateOnlyString(d);
}

/** The nearest business day strictly before `dateStr` (skips weekends). */
export function lastBusinessDayBefore(dateStr: string): string {
  const d = parseDateOnly(dateStr);
  do {
    d.setUTCDate(d.getUTCDate() - 1);
  } while (isWeekendDate(d));
  return toDateOnlyString(d);
}

/**
 * The earliest/latest selectable expedited date for an order placed "now",
 * and which weekday `now` falls on and cutoff-time comparison — used both
 * for the real calculation and (with a synthetic `now`) for the
 * schedule-only max-lead-time simulation below.
 *
 * Earliest: the next business day — but if "now" is past the cutoff *time*
 * (a daily threshold, independent of which weekday it is), the next
 * business day is blocked too and the earliest slot pushes out one more
 * business day. Latest: the last business day before the order's normal
 * (non-expedited) completion date, since choosing the normal date itself
 * needs no rush fee.
 */
function computeWindowMinMax(settings: AppSettings, now: Date): { min: string; max: string } {
  const tz = settings.businessTimezone;
  const { hour: localHour, minute: localMinute } = getLocalWallTime(now, tz);
  const localMinutes = localHour * 60 + localMinute;

  const [cutoffH, cutoffM] = settings.cutoffTime.split(":").map(Number);
  const cutoffMinutes = cutoffH * 60 + (cutoffM ?? 0);

  const todayStr = toDateOnlyString(now);
  let min = firstBusinessDayAfter(todayStr);
  if (localMinutes > cutoffMinutes) {
    // Past today's cutoff-time threshold — the immediate next business day
    // is no longer achievable, push to the one after.
    min = firstBusinessDayAfter(min);
  }

  const normalCompletion = computeExpectedCompletion(settings, now);
  const max = lastBusinessDayBefore(normalCompletion);

  return { min, max };
}

/**
 * The fixed number of tiered rush-fee positions this schedule can ever
 * produce — the longest possible expedited window, considering only the
 * cutoff/completion configuration (not "today"). Computed by simulating
 * every weekday x {at-or-before, just-after} the cutoff-time threshold,
 * using UTC-anchored synthetic dates so the result never depends on
 * businessTimezone/DST specifics — only the configured weekday/time
 * pattern, which is what should "lock in" the table.
 */
export function computeFixedMaxLeadDays(settings: AppSettings): number {
  const syntheticSettings: AppSettings = { ...settings, businessTimezone: "UTC" };
  const [cutoffH, cutoffM] = settings.cutoffTime.split(":").map(Number);
  const cutoffMinutes = cutoffH * 60 + (cutoffM ?? 0);

  let maxN = 1;
  // 2023-01-01 is a Sunday (dow 0); day offset i => dow i.
  for (let dow = 0; dow < 7; dow++) {
    for (const minutes of [cutoffMinutes, cutoffMinutes + 1]) {
      const hh = Math.floor(minutes / 60) % 24;
      const mm = minutes % 60;
      const syntheticNow = new Date(Date.UTC(2023, 0, 1 + dow, hh, mm));
      const { min, max } = computeWindowMinMax(syntheticSettings, syntheticNow);
      if (max < min) continue; // no valid window at this instant
      const n = businessDaysBetween(min, max) + 1; // min itself is position 1
      if (n > maxN) maxN = n;
    }
  }
  return maxN;
}

/**
 * The valid window for an expedited requested date placed "now": see
 * computeWindowMinMax for min/max. `maxDaysOut` is the FIXED number of
 * tiered rush-fee positions for this schedule (see computeFixedMaxLeadDays)
 * — it does not vary with "today", only with the cutoff/completion config.
 */
export function getExpeditedDateWindow(
  settings: AppSettings,
  now: Date,
): { min: string; max: string; maxDaysOut: number } {
  const { min, max } = computeWindowMinMax(settings, now);
  const maxDaysOut = computeFixedMaxLeadDays(settings);
  return { min, max, maxDaysOut };
}

/**
 * Tiered rush fee percentage for a given requested date. Position 1 (the
 * window's earliest slot, `min`) gets rushFeeTierMaxPercent; position N
 * (computeFixedMaxLeadDays) gets rushFeeTierMinPercent; positions in
 * between are linearly interpolated. The percent-per-position table is
 * fixed by the schedule config alone — only which position a given
 * requestedDate lands on depends on "now" (via the window's `min`).
 */
export function computeTieredRushFeePercent(
  settings: AppSettings,
  now: Date,
  requestedDateStr: string,
): number {
  const { min, maxDaysOut } = getExpeditedDateWindow(settings, now);
  if (maxDaysOut <= 1) return settings.rushFeeTierMaxPercent;

  const position = Math.min(Math.max(1 + businessDaysBetween(min, requestedDateStr), 1), maxDaysOut);
  const t = (maxDaysOut - position) / (maxDaysOut - 1); // 1 at position 1 (most urgent) -> 0 at maxDaysOut
  return settings.rushFeeTierMinPercent + (settings.rushFeeTierMaxPercent - settings.rushFeeTierMinPercent) * t;
}

/** Compute rush fee from subtotal and settings. */
export function computeRushFee(
  subtotal: number,
  settings: AppSettings,
  opts?: { now?: Date; requestedDate?: string },
): number {
  if (settings.rushFeeMode === "disabled") return 0;
  if (settings.rushFeeMode === "flat") return settings.rushFeeValue;
  if (settings.rushFeeMode === "tiered") {
    if (!opts?.requestedDate) return 0;
    const pct = computeTieredRushFeePercent(settings, opts.now ?? new Date(), opts.requestedDate);
    return Math.round(subtotal * (pct / 100) * 100) / 100;
  }
  // percentage
  return Math.round(subtotal * (settings.rushFeeValue / 100) * 100) / 100;
}
