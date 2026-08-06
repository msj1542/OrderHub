"use client";

import { useActionState, useState } from "react";
import { Button }    from "@/components/ui/button";
import { Input }     from "@/components/ui/input";
import { Label }     from "@/components/ui/label";
import { Alert }     from "@/components/ui/alert";
import { FieldHint } from "@/components/ui/field-hint";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { AppSettings } from "@/lib/settings/schedule";
import { saveOperationsSettingsAction } from "@/app/(app)/settings/operations/actions";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function OperationsSettingsPanel({ settings }: { settings: AppSettings }) {
  const [state, action, pending] = useActionState(saveOperationsSettingsAction, {});
  const [rushFeeMode, setRushFeeMode] = useState(settings.rushFeeMode);

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
              <FieldHint text="IANA timezone name (e.g. America/Chicago). Drives every date/completion calculation." />
            </Label>
            <Input id="tz" name="businessTimezone" required defaultValue={settings.businessTimezone} placeholder="America/Chicago" style={{ maxWidth: 260 }} />
          </div>

          <div style={{ borderTop: "1px solid var(--color-border-subtle)", paddingTop: "var(--space-5)" }}>
            <h3 style={{ fontSize: "var(--text-sm)", fontWeight: "var(--weight-semibold)", margin: "0 0 var(--space-3)" }}>Order cutoff</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-[var(--space-4)]">
              <div>
                <Label htmlFor="cutoffWeekday">Cutoff weekday</Label>
                <Select name="cutoffWeekday" defaultValue={settings.cutoffWeekday}>
                  <SelectTrigger id="cutoffWeekday"><SelectValue /></SelectTrigger>
                  <SelectContent>{WEEKDAYS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="cutoffTime">Cutoff time</Label>
                <Input id="cutoffTime" name="cutoffTime" type="time" required defaultValue={settings.cutoffTime} />
              </div>
            </div>
          </div>

          <div>
            <h3 style={{ fontSize: "var(--text-sm)", fontWeight: "var(--weight-semibold)", margin: "0 0 var(--space-3)" }}>Estimated completion</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-[var(--space-4)]">
              <div>
                <Label htmlFor="completionWeekday">Completion weekday</Label>
                <Select name="completionWeekday" defaultValue={settings.completionWeekday}>
                  <SelectTrigger id="completionWeekday"><SelectValue /></SelectTrigger>
                  <SelectContent>{WEEKDAYS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="completionTime">Completion time</Label>
                <Input id="completionTime" name="completionTime" type="time" required defaultValue={settings.completionTime} />
              </div>
            </div>
            <p style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", margin: "var(--space-2) 0 0" }}>
              Orders placed on/before cutoff complete this week; placed after cutoff, the following week.
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
                    <SelectItem value="percentage">Percentage of subtotal</SelectItem>
                    <SelectItem value="flat">Flat amount</SelectItem>
                    <SelectItem value="disabled">Disabled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {rushFeeMode !== "disabled" && (
                <div>
                  <Label htmlFor="rushFeeValue">{rushFeeMode === "flat" ? "Amount ($)" : "Percentage (%)"}</Label>
                  <Input id="rushFeeValue" name="rushFeeValue" type="number" min="0" step="0.01" required defaultValue={settings.rushFeeValue} />
                </div>
              )}
            </div>
          </div>

          <div style={{ borderTop: "1px solid var(--color-border-subtle)", paddingTop: "var(--space-5)" }}>
            <Label htmlFor="duplicateWindowDays" style={{ display: "flex", alignItems: "center", gap: "var(--space-1)" }}>
              Duplicate PO window (days)
              <FieldHint text="A new order with the same PO number within this many days of an existing one for the same company triggers a duplicate warning." />
            </Label>
            <Input id="duplicateWindowDays" name="duplicateWindowDays" type="number" min="0" step="1" required defaultValue={settings.duplicateWindowDays} style={{ maxWidth: 120 }} />
          </div>

          <div>
            <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save Settings"}</Button>
          </div>
        </form>
      </div>
    </section>
  );
}
