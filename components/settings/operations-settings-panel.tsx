"use client";

import { useActionState, useMemo, useState } from "react";
import { Button }    from "@/components/ui/button";
import { Input }     from "@/components/ui/input";
import { Label }     from "@/components/ui/label";
import { Alert }     from "@/components/ui/alert";
import { FieldHint } from "@/components/ui/field-hint";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { AppSettings } from "@/lib/settings/schedule";
import { computeFixedMaxLeadDays } from "@/lib/settings/scheduleCalc";
import { saveOperationsSettingsAction } from "@/app/(app)/settings/operations/actions";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// Curated list rather than the full ~400-zone IANA database — this is a
// single US-based business's operating timezone, not a general-purpose
// locale picker. Values are real IANA zone names (validated server-side by
// isValidIanaTimezone too) so Intl/DST handling stays correct year-round.
const TIMEZONES = [
  { value: "America/New_York",    label: "Eastern (America/New_York)" },
  { value: "America/Chicago",     label: "Central (America/Chicago)" },
  { value: "America/Denver",      label: "Mountain (America/Denver)" },
  { value: "America/Phoenix",     label: "Mountain — no DST (America/Phoenix)" },
  { value: "America/Los_Angeles", label: "Pacific (America/Los_Angeles)" },
  { value: "America/Anchorage",   label: "Alaska (America/Anchorage)" },
  { value: "Pacific/Honolulu",    label: "Hawaii (Pacific/Honolulu)" },
  { value: "UTC",                 label: "UTC" },
];

export function OperationsSettingsPanel({ settings }: { settings: AppSettings }) {
  const [state, action, pending] = useActionState(saveOperationsSettingsAction, {});
  const [rushFeeMode, setRushFeeMode] = useState(settings.rushFeeMode);
  const [businessTimezone, setBusinessTimezone] = useState(settings.businessTimezone);

  // Fields that feed the live tiered-rush-fee preview table below need to
  // be controlled so the table recalculates as the schedule is edited,
  // before the form is even saved.
  const [cutoffWeekday, setCutoffWeekday]             = useState(settings.cutoffWeekday);
  const [cutoffTime, setCutoffTime]                   = useState(settings.cutoffTime);
  const [completionWeekday, setCompletionWeekday]     = useState(settings.completionWeekday);
  const [completionTime, setCompletionTime]           = useState(settings.completionTime);
  const [completionWeekOffset, setCompletionWeekOffset] = useState(settings.completionWeekOffset);
  const [tierMaxPercent, setTierMaxPercent]           = useState(String(settings.rushFeeTierMaxPercent));
  const [tierMinPercent, setTierMinPercent]           = useState(String(settings.rushFeeTierMinPercent));

  const tierTable = useMemo(() => {
    const maxPercent = parseFloat(tierMaxPercent);
    const minPercent = parseFloat(tierMinPercent);
    if (!Number.isFinite(maxPercent) || !Number.isFinite(minPercent)) return [];
    const previewSettings: AppSettings = {
      ...settings,
      cutoffWeekday, cutoffTime, completionWeekday, completionTime, completionWeekOffset,
      rushFeeTierMaxPercent: maxPercent,
      rushFeeTierMinPercent: minPercent,
    };
    const n = computeFixedMaxLeadDays(previewSettings);
    return Array.from({ length: n }, (_, i) => {
      const position = i + 1;
      const t = n <= 1 ? 1 : (n - position) / (n - 1);
      const pct = minPercent + (maxPercent - minPercent) * t;
      return { position, pct };
    });
  }, [settings, cutoffWeekday, cutoffTime, completionWeekday, completionTime, completionWeekOffset, tierMaxPercent, tierMinPercent]);

  // If the stored value (e.g. from before this was a dropdown) isn't one of
  // the curated zones, keep it selectable so saving the form doesn't
  // silently change it out from under the admin.
  const timezoneOptions = TIMEZONES.some((t) => t.value === settings.businessTimezone)
    ? TIMEZONES
    : [...TIMEZONES, { value: settings.businessTimezone, label: `${settings.businessTimezone} (current)` }];

  return (
    <section
      style={{ background: "var(--color-panel)", border: "1px solid var(--color-border-default)", borderRadius: "var(--radius-lg)", overflow: "hidden", maxWidth: 640 }}
    >
      <div style={{ padding: "var(--space-5) var(--space-6)", borderBottom: "1px solid var(--color-border-subtle)" }}>
        <h2 style={{ fontSize: "var(--text-lg)", margin: 0 }}>Operations</h2>
        <p style={{ fontSize: "var(--text-sm)", color: "var(--color-text-muted)", margin: "var(--space-2) 0 0" }}>
          Business timezone, order cutoff and completion schedule, rush fee, and duplicate-PO detection window.
        </p>
      </div>

      <div style={{ padding: "var(--space-6)" }}>
        {(state.error || state.success) && (
          <Alert variant={state.error ? "danger" : "success"} className="mb-4">{state.error ?? state.success}</Alert>
        )}

        <form action={action} style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
          <div>
            <Label htmlFor="tz" style={{ display: "flex", alignItems: "center", gap: "var(--space-1)" }}>
              Business timezone
              <FieldHint text="Drives every date/completion calculation, and how dates/times display throughout the app — cutoff countdown, due dates, order timestamps, comments, and notifications all use this single setting." />
            </Label>
            <Select name="businessTimezone" value={businessTimezone} onValueChange={setBusinessTimezone}>
              <SelectTrigger id="tz" style={{ maxWidth: 320 }}><SelectValue /></SelectTrigger>
              <SelectContent>
                {timezoneOptions.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div style={{ borderTop: "1px solid var(--color-border-subtle)", paddingTop: "var(--space-5)" }}>
            <h3 style={{ fontSize: "var(--text-sm)", fontWeight: "var(--weight-semibold)", margin: "0 0 var(--space-3)" }}>Order cutoff</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-[var(--space-4)]">
              <div>
                <Label htmlFor="cutoffWeekday">Cutoff weekday</Label>
                <Select name="cutoffWeekday" value={cutoffWeekday} onValueChange={setCutoffWeekday}>
                  <SelectTrigger id="cutoffWeekday"><SelectValue /></SelectTrigger>
                  <SelectContent>{WEEKDAYS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="cutoffTime">Cutoff time</Label>
                <Input id="cutoffTime" name="cutoffTime" type="time" required value={cutoffTime} onChange={(e) => setCutoffTime(e.target.value)} />
              </div>
            </div>
          </div>

          <div>
            <h3 style={{ fontSize: "var(--text-sm)", fontWeight: "var(--weight-semibold)", margin: "0 0 var(--space-3)" }}>Estimated completion</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-[var(--space-4)]">
              <div>
                <Label htmlFor="completionWeekday">Completion weekday</Label>
                <Select name="completionWeekday" value={completionWeekday} onValueChange={setCompletionWeekday}>
                  <SelectTrigger id="completionWeekday"><SelectValue /></SelectTrigger>
                  <SelectContent>{WEEKDAYS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="completionTime">Completion time</Label>
                <Input id="completionTime" name="completionTime" type="time" required value={completionTime} onChange={(e) => setCompletionTime(e.target.value)} />
              </div>
            </div>
            <div style={{ marginTop: "var(--space-4)" }}>
              <Label htmlFor="completionWeekOffset" style={{ display: "flex", alignItems: "center", gap: "var(--space-1)" }}>
                Completion cycle
                <FieldHint text="Disambiguates the cutoff-to-completion turnaround when the completion weekday falls on or before the cutoff weekday (e.g. cutoff Monday / completion Tuesday could mean a 1-day or an 8-day turnaround)." />
              </Label>
              <Select name="completionWeekOffset" value={completionWeekOffset} onValueChange={(v) => setCompletionWeekOffset(v as "same" | "next")}>
                <SelectTrigger id="completionWeekOffset" style={{ maxWidth: 320 }}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="same">Same week as cutoff</SelectItem>
                  <SelectItem value="next">Following week after cutoff</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", margin: "var(--space-2) 0 0" }}>
              Orders placed on/before cutoff complete that cycle; placed after cutoff, one full cycle later.
            </p>
          </div>

          <div style={{ borderTop: "1px solid var(--color-border-subtle)", paddingTop: "var(--space-5)" }}>
            <h3 style={{ fontSize: "var(--text-sm)", fontWeight: "var(--weight-semibold)", margin: "0 0 var(--space-3)" }}>Rush fee</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-[var(--space-4)]">
              <div>
                <Label htmlFor="rushFeeMode">Mode</Label>
                <Select name="rushFeeMode" value={rushFeeMode} onValueChange={(v) => setRushFeeMode(v as typeof rushFeeMode)}>
                  <SelectTrigger id="rushFeeMode"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Simple — flat percentage of subtotal</SelectItem>
                    <SelectItem value="flat">Simple — flat amount</SelectItem>
                    <SelectItem value="tiered">Tiered — scales with days until requested date</SelectItem>
                    <SelectItem value="disabled">Disabled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {(rushFeeMode === "percentage" || rushFeeMode === "flat") && (
                <div>
                  <Label htmlFor="rushFeeValue">{rushFeeMode === "flat" ? "Amount ($)" : "Percentage (%)"}</Label>
                  <Input id="rushFeeValue" name="rushFeeValue" type="number" min="0" step="0.01" required defaultValue={settings.rushFeeValue} />
                </div>
              )}
            </div>
            {rushFeeMode === "tiered" && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-[var(--space-4)]" style={{ marginTop: "var(--space-4)" }}>
                  <div>
                    <Label htmlFor="rushFeeTierMaxPercent" style={{ display: "flex", alignItems: "center", gap: "var(--space-1)" }}>
                      Max % (1 business day out)
                      <FieldHint text="Fee percentage charged when the requested date is the earliest possible business day — the most urgent slot." />
                    </Label>
                    <Input id="rushFeeTierMaxPercent" name="rushFeeTierMaxPercent" type="number" min="0" step="0.1" required value={tierMaxPercent} onChange={(e) => setTierMaxPercent(e.target.value)} />
                  </div>
                  <div>
                    <Label htmlFor="rushFeeTierMinPercent" style={{ display: "flex", alignItems: "center", gap: "var(--space-1)" }}>
                      Min % (last day before normal completion)
                      <FieldHint text="Fee percentage charged at the least urgent expedited slot — the business day right before the order would complete normally anyway. Days in between are scaled linearly between these two values." />
                    </Label>
                    <Input id="rushFeeTierMinPercent" name="rushFeeTierMinPercent" type="number" min="0" step="0.1" required value={tierMinPercent} onChange={(e) => setTierMinPercent(e.target.value)} />
                  </div>
                  <p style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", margin: 0, gridColumn: "1 / -1" }}>
                    Weekends don&apos;t count toward the day span. These percentages are figured once from the schedule above (not from today&apos;s date) and locked in — see the preview table below.
                  </p>
                </div>

                {tierTable.length > 0 && (
                  <div style={{ marginTop: "var(--space-4)" }}>
                    <p style={{ fontSize: "var(--text-xs)", fontWeight: "var(--weight-semibold)", color: "var(--color-text-muted)", margin: "0 0 var(--space-2)" }}>
                      Locked-in rush fee by lead time (preview — recalculates as the schedule above changes)
                    </p>
                    <div style={{ overflowX: "auto", border: "1px solid var(--color-border-subtle)", borderRadius: "var(--radius-md)" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--text-sm)" }}>
                        <thead>
                          <tr style={{ background: "var(--color-sunken)" }}>
                            <th style={{ textAlign: "left", padding: "var(--space-2) var(--space-3)", fontWeight: "var(--weight-semibold)" }}>Business days out</th>
                            <th style={{ textAlign: "right", padding: "var(--space-2) var(--space-3)", fontWeight: "var(--weight-semibold)" }}>Fee %</th>
                          </tr>
                        </thead>
                        <tbody>
                          {tierTable.map(({ position, pct }) => (
                            <tr key={position} style={{ borderTop: "1px solid var(--color-border-subtle)" }}>
                              <td style={{ padding: "var(--space-2) var(--space-3)" }}>{position}</td>
                              <td style={{ padding: "var(--space-2) var(--space-3)", textAlign: "right" }}>{pct.toFixed(2)}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          <div style={{ borderTop: "1px solid var(--color-border-subtle)", paddingTop: "var(--space-5)" }}>
            <Label htmlFor="duplicateWindowDays" style={{ display: "flex", alignItems: "center", gap: "var(--space-1)" }}>
              Duplicate PO window (days)
              <FieldHint text="A new order with the same PO number within this many days of an existing one for the same company triggers a duplicate warning." />
            </Label>
            <Input id="duplicateWindowDays" name="duplicateWindowDays" type="number" min="0" step="1" required defaultValue={settings.duplicateWindowDays} style={{ maxWidth: 120 }} />
          </div>

          <div style={{ borderTop: "1px solid var(--color-border-subtle)", paddingTop: "var(--space-5)" }}>
            <h3 style={{ fontSize: "var(--text-sm)", fontWeight: "var(--weight-semibold)", margin: "0 0 var(--space-3)", display: "flex", alignItems: "center", gap: "var(--space-1)" }}>
              Label size
              <FieldHint text="Physical dimensions of the piece labels printed from Production and the Print Labels dialog." />
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-[var(--space-4)]">
              <div>
                <Label htmlFor="labelWidthIn">Width (inches)</Label>
                <Input id="labelWidthIn" name="labelWidthIn" type="number" min="0.5" step="0.1" required defaultValue={settings.labelWidthIn} />
              </div>
              <div>
                <Label htmlFor="labelHeightIn">Height (inches)</Label>
                <Input id="labelHeightIn" name="labelHeightIn" type="number" min="0.5" step="0.1" required defaultValue={settings.labelHeightIn} />
              </div>
            </div>
          </div>

          <div>
            <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save Settings"}</Button>
          </div>
        </form>
      </div>
    </section>
  );
}
