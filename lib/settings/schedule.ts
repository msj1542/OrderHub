/**
 * Server-only settings read path (getSettings() touches the database).
 * All pure schedule/rush-fee calculations live in scheduleCalc.ts, which
 * has no database import and is safe for client components to import
 * directly — this file re-exports them too so existing server-side call
 * sites don't need to change their import path.
 */

import { db } from "@/lib/db";
import { applicationSettings } from "@/lib/db/schema";

export type {
  AppSettings,
} from "./scheduleCalc";

export {
  computeExpectedCompletion,
  isWeekendDateString,
  businessDaysBetween,
  firstBusinessDayAfter,
  lastBusinessDayBefore,
  getExpeditedDateWindow,
  computeFixedMaxLeadDays,
  computeTieredRushFeePercent,
  computeRushFee,
} from "./scheduleCalc";

import type { AppSettings } from "./scheduleCalc";

export async function getSettings(): Promise<AppSettings> {
  const rows = await db.select().from(applicationSettings);
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));

  const rushMode = map.rush_fee_mode ?? "percentage";

  return {
    businessTimezone:    map.business_timezone    ?? process.env.BUSINESS_TIMEZONE ?? "America/Chicago",
    rushFeeMode:         (rushMode === "flat" || rushMode === "disabled" || rushMode === "tiered") ? rushMode : "percentage",
    rushFeeValue:        Number(map.rush_fee_value ?? 20),
    rushFeeTierMaxPercent: Number(map.rush_fee_tier_max_percent ?? 34.5),
    rushFeeTierMinPercent: Number(map.rush_fee_tier_min_percent ?? 3),
    cutoffWeekday:       map.cutoff_weekday        ?? "Monday",
    cutoffTime:          map.cutoff_time            ?? "12:00",
    completionWeekday:   map.completion_weekday     ?? "Friday",
    completionTime:      map.completion_time        ?? "15:30",
    completionWeekOffset: map.completion_week_offset === "next" ? "next" : "same",
    duplicateWindowDays: Number(map.duplicate_window_days ?? 3),
    labelWidthIn:        Number(map.label_width_in  ?? 3),
    labelHeightIn:       Number(map.label_height_in ?? 1),
  };
}
