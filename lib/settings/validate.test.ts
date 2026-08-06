import { describe, it, expect } from "vitest";
import { validateOperationsSettings, type OperationsSettingsInput } from "./validate";

const base: OperationsSettingsInput = {
  businessTimezone:   "America/Chicago",
  rushFeeMode:        "percentage",
  rushFeeValue:       20,
  cutoffWeekday:      "Monday",
  cutoffTime:         "12:00",
  completionWeekday:  "Friday",
  completionTime:     "15:30",
  duplicateWindowDays: 3,
};

describe("validateOperationsSettings", () => {
  it("passes for valid input", () => {
    expect(validateOperationsSettings(base)).toBeNull();
  });

  it("requires a business timezone", () => {
    expect(validateOperationsSettings({ ...base, businessTimezone: "" })).toMatch(/timezone/i);
  });

  it("rejects an invalid rush fee mode", () => {
    expect(validateOperationsSettings({ ...base, rushFeeMode: "bogus" })).toMatch(/rush fee mode/i);
  });

  it("requires a non-negative rush fee value unless disabled", () => {
    expect(validateOperationsSettings({ ...base, rushFeeValue: -5 })).toMatch(/rush fee value/i);
  });

  it("allows a missing/negative rush fee value when disabled", () => {
    expect(validateOperationsSettings({ ...base, rushFeeMode: "disabled", rushFeeValue: -5 })).toBeNull();
  });

  it("rejects an invalid weekday", () => {
    expect(validateOperationsSettings({ ...base, cutoffWeekday: "Someday" })).toMatch(/cutoff weekday/i);
    expect(validateOperationsSettings({ ...base, completionWeekday: "Someday" })).toMatch(/completion weekday/i);
  });

  it("rejects a malformed time", () => {
    expect(validateOperationsSettings({ ...base, cutoffTime: "25:00" })).toMatch(/cutoff time/i);
    expect(validateOperationsSettings({ ...base, completionTime: "9:30" })).toMatch(/completion time/i);
  });

  it("rejects a negative or fractional duplicate window", () => {
    expect(validateOperationsSettings({ ...base, duplicateWindowDays: -1 })).toMatch(/duplicate/i);
    expect(validateOperationsSettings({ ...base, duplicateWindowDays: 2.5 })).toMatch(/duplicate/i);
  });

  it("allows a zero-day duplicate window (feature disabled)", () => {
    expect(validateOperationsSettings({ ...base, duplicateWindowDays: 0 })).toBeNull();
  });
});
