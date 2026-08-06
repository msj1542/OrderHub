/**
 * Operations settings — write path. Read path is `getSettings()` in
 * lib/settings/schedule.ts; this module is the only place that writes to
 * `application_settings`.
 */

import { db } from "@/lib/db";
import { applicationSettings } from "@/lib/db/schema";
import { validateOperationsSettings, type OperationsSettingsInput } from "@/lib/settings/validate";

const KEY_MAP: Record<keyof OperationsSettingsInput, string> = {
  businessTimezone:   "business_timezone",
  rushFeeMode:        "rush_fee_mode",
  rushFeeValue:       "rush_fee_value",
  cutoffWeekday:      "cutoff_weekday",
  cutoffTime:         "cutoff_time",
  completionWeekday:  "completion_weekday",
  completionTime:     "completion_time",
  duplicateWindowDays: "duplicate_window_days",
};

export async function updateOperationsSettings(
  input: OperationsSettingsInput,
  modifiedBy: string,
): Promise<void> {
  const validationError = validateOperationsSettings(input);
  if (validationError) throw new Error(validationError);

  const now = new Date();
  await db.transaction(async (tx) => {
    for (const [field, key] of Object.entries(KEY_MAP) as [keyof OperationsSettingsInput, string][]) {
      await tx
        .insert(applicationSettings)
        .values({ key, value: String(input[field]), modifiedBy, updatedAt: now })
        .onConflictDoUpdate({
          target: applicationSettings.key,
          set:    { value: String(input[field]), modifiedBy, updatedAt: now },
        });
    }
  });
}
