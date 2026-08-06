/** Pure validation for the Operations settings form. */

const WEEKDAYS = new Set([
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
]);
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const RUSH_MODES = new Set(["percentage", "flat", "disabled"]);

export type OperationsSettingsInput = {
  businessTimezone:    string;
  rushFeeMode:         string;
  rushFeeValue:         number;
  cutoffWeekday:        string;
  cutoffTime:           string;
  completionWeekday:    string;
  completionTime:       string;
  duplicateWindowDays:  number;
};

export function validateOperationsSettings(input: OperationsSettingsInput): string | null {
  if (!input.businessTimezone.trim()) return "Business timezone is required.";
  if (!RUSH_MODES.has(input.rushFeeMode)) return "Invalid rush fee mode.";
  if (input.rushFeeMode !== "disabled" && (!Number.isFinite(input.rushFeeValue) || input.rushFeeValue < 0)) {
    return "Rush fee value must be a non-negative number.";
  }
  if (!WEEKDAYS.has(input.cutoffWeekday)) return "Invalid cutoff weekday.";
  if (!WEEKDAYS.has(input.completionWeekday)) return "Invalid completion weekday.";
  if (!TIME_PATTERN.test(input.cutoffTime)) return "Cutoff time must be in HH:MM format.";
  if (!TIME_PATTERN.test(input.completionTime)) return "Completion time must be in HH:MM format.";
  if (!Number.isInteger(input.duplicateWindowDays) || input.duplicateWindowDays < 0) {
    return "Duplicate PO window must be a non-negative whole number of days.";
  }
  return null;
}
