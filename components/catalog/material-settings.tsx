"use client";

import { useActionState, useState, type ReactNode } from "react";
import { Button }    from "@/components/ui/button";
import { Input }     from "@/components/ui/input";
import { Label }     from "@/components/ui/label";
import { Alert }     from "@/components/ui/alert";
import { FieldHint } from "@/components/ui/field-hint";
import type { MaterialWithRolls, MaterialRollWidth } from "@/lib/db/schema";
import { saveMaterialAction, addRollAction, updateRollAction } from "@/app/(app)/settings/materials/actions";

interface Props {
  materials: MaterialWithRolls[];
}

export function MaterialSettingsPanel({ materials }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(materials[0]?.id ?? null);
  const selected = materials.find((m) => m.id === selectedId);

  return (
    <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-[var(--space-4)] items-start">
      {/* List */}
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
            padding:        "var(--space-4) var(--space-5)",
            borderBottom:   "1px solid var(--color-border-subtle)",
            display:        "flex",
            alignItems:     "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <p style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: "var(--weight-semibold)" }}>
              Production materials
            </p>
            <h2 style={{ fontSize: "var(--text-lg)", margin: "var(--space-1) 0 0" }}>Materials</h2>
          </div>
          <Button size="sm" onClick={() => setSelectedId(null)}>+ New</Button>
        </div>

        <div style={{ overflowY: "auto" }}>
          {materials.length === 0 && (
            <p style={{ padding: "var(--space-5) var(--space-4)", fontSize: "var(--text-sm)", color: "var(--color-text-muted)", textAlign: "center" }}>
              No materials yet. Use &quot;+ New&quot; to add your first material.
            </p>
          )}
          {materials.map((m) => (
            <button
              key={m.id}
              onClick={() => setSelectedId(m.id)}
              className={m.id !== selectedId ? "hover:bg-[var(--color-sunken)] transition-colors" : undefined}
              style={{
                display:     "block",
                width:       "100%",
                textAlign:   "left",
                padding:     "var(--space-3) var(--space-4)",
                background:  selectedId === m.id ? "var(--color-brand-subtle)" : "transparent",
                border:      "none",
                borderBottom: "1px solid var(--color-border-subtle)",
                cursor:      "pointer",
                color:       selectedId === m.id ? "var(--color-brand)" : "var(--color-text-primary)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                <span
                  style={{
                    display:      "inline-block",
                    width:        8,
                    height:       8,
                    borderRadius: "50%",
                    background:   m.isActive ? "var(--status-success-text)" : "var(--color-text-muted)",
                    flexShrink:   0,
                  }}
                />
                <strong style={{ fontSize: "var(--text-sm)" }}>{m.name}</strong>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Editor */}
      <MaterialEditor
        key={selected?.id ?? "new-material"}
        material={selected}
      />
    </div>
  );
}

// ── Material editor ───────────────────────────────────────────

function MaterialEditor({ material }: { material?: MaterialWithRolls }) {
  const [saveState, saveAction, savePending] = useActionState(saveMaterialAction, {});

  return (
    <section
      style={{
        background:   "var(--color-panel)",
        border:       "1px solid var(--color-border-default)",
        borderRadius: "var(--radius-lg)",
        overflow:     "hidden",
      }}
    >
      <div style={{ padding: "var(--space-5) var(--space-6)", borderBottom: "1px solid var(--color-border-subtle)" }}>
        <p style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: "var(--weight-semibold)" }}>
          Material profile
        </p>
        <h2 style={{ fontSize: "var(--text-lg)", margin: "var(--space-1) 0 0" }}>
          {material ? `Edit ${material.name}` : "Create Material"}
        </h2>
        <p style={{ fontSize: "var(--text-sm)", color: "var(--color-text-muted)", margin: "var(--space-2) 0 0" }}>
          Roll-cost outputs: square-foot cost divides total cost by roll area; linear-inch cost divides by total roll length.
        </p>
      </div>

      <div style={{ padding: "var(--space-6)" }}>
        {(saveState.error || saveState.success) && (
          <Alert variant={saveState.error ? "danger" : "success"} className="mb-4">
            {saveState.error ?? saveState.success}
          </Alert>
        )}

        <form action={saveAction} style={{ marginBottom: material ? "var(--space-8)" : 0 }}>
          {material && <input type="hidden" name="id" value={material.id} />}

          <div
            style={{
              display:             "grid",
              gridTemplateColumns: "1fr 1fr auto",
              gap:                 "var(--space-4)",
              alignItems:          "end",
            }}
          >
            <div>
              <Label htmlFor="mat-name">Material name</Label>
              <Input
                id="mat-name"
                name="name"
                required
                defaultValue={material?.name ?? ""}
                placeholder="Gloss PPF"
              />
            </div>
            <div>
              <Label htmlFor="mat-code" style={{ display: "flex", alignItems: "center", gap: "var(--space-1)" }}>
                Order code
                <FieldHint text="Short label shown when selecting material on an order." />
              </Label>
              <Input
                id="mat-code"
                name="code"
                required
                defaultValue={material?.code ?? ""}
                placeholder="Gloss"
              />
            </div>
            <div>
              <label style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", paddingBottom: "var(--space-1)", cursor: "pointer" }}>
                <input type="hidden" name="isActive" value="false" />
                <input
                  type="checkbox"
                  name="isActive"
                  value="true"
                  defaultChecked={material?.isActive ?? true}
                />
                <span style={{ fontSize: "var(--text-sm)", whiteSpace: "nowrap" }}>Available for orders</span>
              </label>
            </div>
          </div>

          <div style={{ marginTop: "var(--space-4)" }}>
            <Button type="submit" disabled={savePending}>
              {savePending ? "Saving…" : material ? "Save Material" : "Create Material"}
            </Button>
          </div>
        </form>

        {/* Roll widths section */}
        {material && (
          <div
            style={{
              paddingTop:  "var(--space-6)",
              borderTop:   "1px solid var(--color-border-subtle)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--space-4)" }}>
              <div>
                <h3 style={{ fontSize: "var(--text-base)", fontWeight: "var(--weight-semibold)", margin: 0 }}>
                  Available roll sizes
                </h3>
                <p style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", margin: "var(--space-1) 0 0" }}>
                  Each size is evaluated independently when a kit needs the narrowest roll wide enough for its required width.
                </p>
              </div>
              <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)" }}>
                {material.rolls.filter((r) => r.isActive).length} active
              </span>
            </div>

            <div
              style={{
                display:             "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
                gap:                 "var(--space-4)",
              }}
            >
              {material.rolls.map((roll) => (
                <RollEditor key={roll.id} roll={roll} />
              ))}
              <AddRollForm materialId={material.id} />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

// ── Shared card bits ───────────────────────────────────────────

function FieldGroupLabel({ children }: { children: ReactNode }) {
  return (
    <p
      style={{
        fontSize:      "var(--text-xs)",
        color:         "var(--color-text-muted)",
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        fontWeight:    "var(--weight-semibold)",
        margin:        "0 0 var(--space-2)",
      }}
    >
      {children}
    </p>
  );
}

/** total cost ÷ roll area (sq ft) and ÷ roll length in linear inches. */
function rollCostOutputs(widthIn: number, lengthFt: number, rollCost: number, handlingCost: number) {
  const total = rollCost + handlingCost;
  const areaSqFt = (widthIn / 12) * lengthFt;
  const lengthIn = lengthFt * 12;
  if (!total || !areaSqFt || !lengthIn) return null;
  return { sqFt: (total / areaSqFt).toFixed(3), linIn: (total / lengthIn).toFixed(4) };
}

// ── Roll editor card ───────────────────────────────────────────

function RollEditor({ roll }: { roll: MaterialRollWidth }) {
  const [state, action, pending] = useActionState(updateRollAction, {});

  const outputs = rollCostOutputs(
    parseFloat(roll.widthIn), parseFloat(roll.lengthFt), parseFloat(roll.rollCost), parseFloat(roll.handlingCost),
  );

  return (
    <form
      action={action}
      style={{
        display:      "flex",
        flexDirection: "column",
        border:       "1px solid var(--color-border-default)",
        borderRadius: "var(--radius-lg)",
        overflow:     "hidden",
        opacity:      roll.isActive ? 1 : 0.6,
      }}
    >
      <input type="hidden" name="id" value={roll.id} />

      <div
        style={{
          display:        "flex",
          alignItems:     "center",
          justifyContent: "space-between",
          padding:        "var(--space-3) var(--space-4)",
          background:     "var(--color-sunken)",
          borderBottom:   "1px solid var(--color-border-subtle)",
        }}
      >
        <strong style={{ fontSize: "var(--text-sm)" }}>{parseFloat(roll.widthIn)}″ roll</strong>
        <label style={{ display: "flex", alignItems: "center", gap: "var(--space-1)", cursor: "pointer" }}>
          <input type="hidden"   name="isActive" value="false" />
          <input
            type="checkbox"
            name="isActive"
            value="true"
            defaultChecked={roll.isActive}
            onChange={(e) => {
              const hidden = e.currentTarget.previousElementSibling as HTMLInputElement;
              hidden.disabled = e.currentTarget.checked;
            }}
          />
          <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)" }}>Active</span>
        </label>
      </div>

      <div style={{ padding: "var(--space-4)", display: "flex", flexDirection: "column", gap: "var(--space-4)", flex: 1 }}>
        <div>
          <FieldGroupLabel>Roll dimensions</FieldGroupLabel>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
            <div>
              <Label style={{ fontSize: "var(--text-xs)" }}>Width (in.)</Label>
              <Input name="widthIn" type="number" min="0.01" step="0.01" defaultValue={parseFloat(roll.widthIn).toString()} />
            </div>
            <div>
              <Label style={{ fontSize: "var(--text-xs)" }}>Length (ft.)</Label>
              <Input name="lengthFt" type="number" min="0.01" step="0.01" defaultValue={parseFloat(roll.lengthFt).toString()} />
            </div>
          </div>
        </div>

        <div>
          <FieldGroupLabel>Cost</FieldGroupLabel>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
            <div>
              <Label style={{ fontSize: "var(--text-xs)" }}>Roll cost ($)</Label>
              <Input name="rollCost" type="number" min="0" step="0.01" defaultValue={parseFloat(roll.rollCost).toString()} />
            </div>
            <div>
              <Label style={{ fontSize: "var(--text-xs)" }}>Handling ($)</Label>
              <Input name="handlingCost" type="number" min="0" step="0.01" defaultValue={parseFloat(roll.handlingCost).toString()} />
            </div>
          </div>
          {outputs && (
            <p style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", margin: "var(--space-2) 0 0" }}>
              ${outputs.sqFt}/sq ft · ${outputs.linIn}/linear in.
            </p>
          )}
        </div>

        {state.error && <Alert variant="danger">{state.error}</Alert>}

        <div style={{ marginTop: "auto" }}>
          <Button type="submit" size="sm" variant="secondary" disabled={pending}>
            {pending ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
    </form>
  );
}

// ── Add roll card ──────────────────────────────────────────────

function AddRollForm({ materialId }: { materialId: string }) {
  const [state, action, pending] = useActionState(addRollAction, {});

  return (
    <form
      action={action}
      style={{
        display:       "flex",
        flexDirection: "column",
        border:        "1px dashed var(--color-border-default)",
        borderRadius:  "var(--radius-lg)",
        overflow:      "hidden",
      }}
    >
      <input type="hidden" name="materialId" value={materialId} />

      <div
        style={{
          padding:      "var(--space-3) var(--space-4)",
          background:   "var(--color-canvas)",
          borderBottom: "1px dashed var(--color-border-default)",
        }}
      >
        <strong style={{ fontSize: "var(--text-sm)", color: "var(--color-text-muted)" }}>New roll size</strong>
      </div>

      <div style={{ padding: "var(--space-4)", display: "flex", flexDirection: "column", gap: "var(--space-4)", flex: 1 }}>
        <div>
          <FieldGroupLabel>Roll dimensions</FieldGroupLabel>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
            <div>
              <Label style={{ fontSize: "var(--text-xs)" }}>Width (in.)</Label>
              <Input name="widthIn" type="number" min="0.01" step="0.01" required />
            </div>
            <div>
              <Label style={{ fontSize: "var(--text-xs)" }}>Length (ft.)</Label>
              <Input name="lengthFt" type="number" min="0.01" step="0.01" defaultValue="100" required />
            </div>
          </div>
        </div>

        <div>
          <FieldGroupLabel>Cost</FieldGroupLabel>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
            <div>
              <Label style={{ fontSize: "var(--text-xs)" }}>Roll cost ($)</Label>
              <Input name="rollCost" type="number" min="0" step="0.01" defaultValue="0" required />
            </div>
            <div>
              <Label style={{ fontSize: "var(--text-xs)" }}>Handling ($)</Label>
              <Input name="handlingCost" type="number" min="0" step="0.01" defaultValue="0" required />
            </div>
          </div>
        </div>

        {state.error && <Alert variant="danger">{state.error}</Alert>}

        <div style={{ marginTop: "auto" }}>
          <Button type="submit" size="sm" variant="secondary" disabled={pending}>
            {pending ? "Adding…" : "+ Add Roll Size"}
          </Button>
        </div>
      </div>
    </form>
  );
}
