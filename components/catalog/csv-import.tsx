"use client";

import { useActionState, useState, useRef } from "react";
import { Button }   from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert }    from "@/components/ui/alert";
import { previewImportAction, applyImportAction, type ImportState } from "@/app/(app)/settings/catalog/actions";

const INIT: ImportState = {};

export function CsvImport() {
  const [previewState, previewAction, previewing] = useActionState(previewImportAction, INIT);
  const [applyState,   applyAction,   applying]   = useActionState(applyImportAction,   INIT);
  const [type, setType] = useState<"product" | "pricing">("pricing");
  const [csvText, setCsvText] = useState("");
  const [sourceName, setSourceName] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const report = previewState.report ?? applyState.report;
  const canApply = !!previewState.report && !previewState.error;

  return (
    <section
      style={{
        background:   "var(--color-panel)",
        border:       "1px solid var(--color-border-default)",
        borderRadius: "var(--radius-lg)",
        overflow:     "hidden",
      }}
    >
      <div
        style={{
          padding:      "var(--space-5) var(--space-6)",
          borderBottom: "1px solid var(--color-border-subtle)",
        }}
      >
        <p style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: "var(--weight-semibold)" }}>
          Controlled update
        </p>
        <h2 style={{ fontSize: "var(--text-lg)", margin: "var(--space-1) 0" }}>CSV Import</h2>
        <p style={{ fontSize: "var(--text-sm)", color: "var(--color-text-muted)", margin: 0 }}>
          Preview additions, changes, warnings, unmatched records, duplicates, and invalid prices before applying.
        </p>
      </div>

      <div style={{ padding: "var(--space-6)" }}>
        {(previewState.error || applyState.error) && (
          <Alert variant="danger" className="mb-4">
            {previewState.error ?? applyState.error}
          </Alert>
        )}
        {applyState.applied && (
          <Alert variant="success" className="mb-4">
            Import applied successfully.
          </Alert>
        )}

        <div
          style={{
            display:             "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gap:                 "var(--space-4)",
            marginBottom:        "var(--space-5)",
          }}
        >
          <div>
            <label style={{ display: "block", fontSize: "var(--text-sm)", fontWeight: "var(--weight-medium)", marginBottom: "var(--space-2)" }}>
              Import type
            </label>
            <Select
              value={type}
              onValueChange={(v) => { setType(v as "product" | "pricing"); setCsvText(""); }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pricing">Pricing catalog</SelectItem>
                <SelectItem value="product">Product definition catalog</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label
              htmlFor="csv-file"
              style={{ display: "block", fontSize: "var(--text-sm)", fontWeight: "var(--weight-medium)", marginBottom: "var(--space-2)" }}
            >
              CSV file
            </label>
            <input
              id="csv-file"
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              style={{ fontSize: "var(--text-sm)", color: "var(--color-text-primary)" }}
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                setSourceName(f.name);
                setCsvText(await f.text());
              }}
            />
          </div>
        </div>

        {/* Validate / Apply buttons */}
        <div style={{ display: "flex", gap: "var(--space-3)", marginBottom: "var(--space-5)" }}>
          <form action={previewAction}>
            <input type="hidden" name="type"    value={type} />
            <input type="hidden" name="csv"     value={csvText} />
            <input type="hidden" name="sourceName" value={sourceName} />
            <Button type="submit" variant="secondary" disabled={!csvText || previewing}>
              {previewing ? "Validating…" : "Validate & Preview"}
            </Button>
          </form>

          {canApply && (
            <form action={applyAction}>
              <input type="hidden" name="type"       value={type} />
              <input type="hidden" name="csv"        value={csvText} />
              <input type="hidden" name="sourceName" value={sourceName} />
              <Button type="submit" disabled={applying}>
                {applying ? "Applying…" : "Apply Import"}
              </Button>
            </form>
          )}
        </div>

        {/* Report */}
        {report && (
          <div
            style={{
              background:   "var(--color-sunken)",
              border:       "1px solid var(--color-border-subtle)",
              borderRadius: "var(--radius-md)",
              padding:      "var(--space-4)",
              fontFamily:   "monospace",
              fontSize:     "var(--text-xs)",
            }}
          >
            <ReportView report={report} />
          </div>
        )}
      </div>
    </section>
  );
}

function ReportView({ report }: { report: Record<string, unknown> }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
      {Object.entries(report).map(([key, value]) => {
        if (Array.isArray(value)) {
          return (
            <div key={key}>
              <strong>{key}:</strong>{" "}
              {value.length === 0
                ? <span style={{ color: "var(--color-text-muted)" }}>none</span>
                : <span style={{ color: value.length > 0 && key.includes("invalid") || key.includes("unmatched") || key.includes("duplicate") ? "var(--status-danger-text)" : "var(--status-success-text)" }}>
                    {value.length} — {value.join(", ")}
                  </span>
              }
            </div>
          );
        }
        return (
          <div key={key}>
            <strong>{key}:</strong> {String(value)}
          </div>
        );
      })}
    </div>
  );
}
