/** Pure validation for the Operations settings form. */

const WEEKDAYS = new Set([
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
]);
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const RUSH_MODES = new Set(["percentage", "flat", "disabled", "tiered"]);

export type OperationsSettingsInput = {
  businessTimezone:    string;
  rushFeeMode:         string;
  rushFeeValue:         number;
  rushFeeTierMaxPercent: number;
  rushFeeTierMinPercent: number;
  cutoffWeekday:        string;
  cutoffTime:           string;
  completionWeekday:    string;
  completionTime:       string;
  completionWeekOffset: string;
  duplicateWindowDays:  number;
  labelWidthIn:         number;
  labelHeightIn:        number;
};

/**
 * The timezone field is free text (an IANA identifier like "America/Chicago"),
 * not a picker — a typo or a non-IANA name like "Central Time" would
 * otherwise be silently accepted and then either crash or silently
 * mis-schedule every cutoff/completion/rush-fee calculation that reads it.
 * `Intl.DateTimeFormat` throws RangeError for anything it doesn't recognize,
 * which is the standard way to validate one — but some engines/ICU builds
 * also accept legacy 3-letter zone abbreviations (e.g. "CST") as backward-
 * compatibility aliases; those are officially deprecated by the IANA tz
 * database precisely because they're ambiguous (CST alone could mean US
 * Central, China, or Cuba) and aren't guaranteed to resolve the same way,
 * or at all, on every engine/version, so they're rejected here too — a
 * proper IANA identifier always has an Area/Location form, with "UTC" as
 * the one canonical exception.
 */
function isValidIanaTimezone(tz: string): boolean {
  if (tz !== "UTC" && !tz.includes("/")) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function validateOperationsSettings(input: OperationsSettingsInput): string | null {
  if (!input.businessTimezone.trim()) return "Business timezone is required.";
  if (!isValidIanaTimezone(input.businessTimezone.trim())) {
    return "Business timezone must be a valid IANA timezone name (e.g. America/Chicago).";
  }
  if (!RUSH_MODES.has(input.rushFeeMode)) return "Invalid rush fee mode.";
  if (input.rushFeeMode === "percentage" || input.rushFeeMode === "flat") {
    if (!Number.isFinite(input.rushFeeValue) || input.rushFeeValue < 0) {
      return "Rush fee value must be a non-negative number.";
    }
  }
  if (input.rushFeeMode === "tiered") {
    if (!Number.isFinite(input.rushFeeTierMaxPercent) || input.rushFeeTierMaxPercent < 0) {
      return "Tiered rush fee max percentage must be a non-negative number.";
    }
    if (!Number.isFinite(input.rushFeeTierMinPercent) || input.rushFeeTierMinPercent < 0) {
      return "Tiered rush fee min percentage must be a non-negative number.";
    }
    if (input.rushFeeTierMinPercent > input.rushFeeTierMaxPercent) {
      return "Tiered rush fee min percentage cannot exceed the max percentage.";
    }
  }
  if (!WEEKDAYS.has(input.cutoffWeekday)) return "Invalid cutoff weekday.";
  if (!WEEKDAYS.has(input.completionWeekday)) return "Invalid completion weekday.";
  if (!TIME_PATTERN.test(input.cutoffTime)) return "Cutoff time must be in HH:MM format.";
  if (!TIME_PATTERN.test(input.completionTime)) return "Completion time must be in HH:MM format.";
  if (input.completionWeekOffset !== "same" && input.completionWeekOffset !== "next") {
    return "Invalid completion week offset.";
  }
  if (!Number.isInteger(input.duplicateWindowDays) || input.duplicateWindowDays < 0) {
    return "Duplicate PO window must be a non-negative whole number of days.";
  }
  if (!Number.isFinite(input.labelWidthIn) || input.labelWidthIn <= 0) {
    return "Label width must be a positive number.";
  }
  if (!Number.isFinite(input.labelHeightIn) || input.labelHeightIn <= 0) {
    return "Label height must be a positive number.";
  }
  return null;
}
