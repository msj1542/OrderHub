/**
 * Expected-completion computation.
 *
 * Rule (decision #1):
 *   - Placed on/before cutoff weekday+time → completed that week on completion weekday+time
 *   - Placed after cutoff → completed the following week
 *
 * "Week" = Mon–Sun, advancing to the next Mon if the current day is past the cutoff.
 */

import { db } from "@/lib/db";
import { applicationSettings } from "@/lib/db/schema";

export type AppSettings = {
  businessTimezone:    string;
  rushFeeMode:         "percentage" | "flat" | "disabled";
  rushFeeValue:        number;
  cutoffWeekday:       string;
  cutoffTime:          string;
  completionWeekday:   string;
  completionTime:      string;
  duplicateWindowDays: number;
};

const WEEKDAY_INDEX: Record<string, number> = {
  Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3,
  Thursday: 4, Friday: 5, Saturday: 6,
};

export async function getSettings(): Promise<AppSettings> {
  const rows = await db.select().from(applicationSettings);
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));

  const rushMode = map.rush_fee_mode ?? "percentage";

  return {
    businessTimezone:    map.business_timezone    ?? process.env.BUSINESS_TIMEZONE ?? "America/Chicago",
    rushFeeMode:         (rushMode === "flat" || rushMode === "disabled") ? rushMode : "percentage",
    rushFeeValue:        Number(map.rush_fee_value ?? 20),
    cutoffWeekday:       map.cutoff_weekday        ?? "Monday",
    cutoffTime:          map.cutoff_time            ?? "12:00",
    completionWeekday:   map.completion_weekday     ?? "Friday",
    completionTime:      map.completion_time        ?? "15:30",
    duplicateWindowDays: Number(map.duplicate_window_days ?? 3),
  };
}

/**
 * Compute the expected completion date for an order placed at `now`.
 * Returns a YYYY-MM-DD string.
 *
 * Algorithm:
 *   1. Find days from today back to the cutoff weekday → this gives the
 *      Monday (cutoff day) of the current "work week".
 *   2. From that Monday, find the completion weekday (Friday) of the same week.
 *   3. If before/on the cutoff → that Friday is the target.
 *      If past the cutoff → that Friday + 7 days (following week).
 */
export function computeExpectedCompletion(settings: AppSettings, now: Date): string {
  const tz = settings.businessTimezone;

  // Get local weekday name + time-of-day in the business timezone
  const localParts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "long",
    hour: "numeric",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const localWeekday = localParts.find((p) => p.type === "weekday")?.value ?? "Monday";
  const localHour    = Number(localParts.find((p) => p.type === "hour")?.value   ?? 0);
  const localMinute  = Number(localParts.find((p) => p.type === "minute")?.value ?? 0);
  const localMinutes = localHour * 60 + localMinute;

  const [cutoffH, cutoffM] = settings.cutoffTime.split(":").map(Number);
  const cutoffMinutes = cutoffH * 60 + (cutoffM ?? 0);

  const cutoffDayIdx     = WEEKDAY_INDEX[settings.cutoffWeekday]    ?? 1; // Mon
  const completionDayIdx = WEEKDAY_INDEX[settings.completionWeekday] ?? 5; // Fri
  const nowDayIdx        = WEEKDAY_INDEX[localWeekday] ?? 1;

  // Days since the cutoff weekday (how far are we into or past the current "work week")
  const daysSinceCutoff = (nowDayIdx - cutoffDayIdx + 7) % 7;

  // The "current work week's" cutoff day in UTC-offset terms
  // daysSinceCutoff=0 means today IS the cutoff day
  const daysToThisWeeksCompletion =
    ((completionDayIdx - cutoffDayIdx + 7) % 7) - daysSinceCutoff;

  // Is the order at/past the cutoff?
  const pastCutoff =
    daysSinceCutoff > 0 ||  // Any day after cutoff weekday
    (daysSinceCutoff === 0 && localMinutes > cutoffMinutes); // Cutoff day but after cutoff time

  let daysToTarget = daysToThisWeeksCompletion;
  if (pastCutoff) {
    daysToTarget += 7; // push to following week's completion
  }

  const completionDate = new Date(now);
  completionDate.setUTCDate(completionDate.getUTCDate() + daysToTarget);
  return completionDate.toISOString().slice(0, 10);
}

/** Compute rush fee from subtotal and settings. */
export function computeRushFee(subtotal: number, settings: AppSettings): number {
  if (settings.rushFeeMode === "disabled") return 0;
  if (settings.rushFeeMode === "flat") return settings.rushFeeValue;
  // percentage
  return Math.round(subtotal * (settings.rushFeeValue / 100) * 100) / 100;
}
