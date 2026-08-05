"use client";

import { useActionState, useState } from "react";
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
    <div
      style={{
        display:             "grid",
        gridTemplateColumns: "280px 1fr",
        gap:                 "var(--space-4)",
        alignItems:          "start",
      }}
    >
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
          {materials.map((m) => (
            <button
              key={m.id}
              onClick={() => setSelectedId(m.id)}
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
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", marginBottom: "var(--space-1)" }}>
                <span
                  style={{
                    display:      "inline-block",
                    width:        8,
                    height:       8,
                    borderRadius: "50%",
                    background:   m.isActive ? "var(--color-success)" : "var(--color-text-muted)",
                    flexShrink:   0,
                  }}
                />
                <strong style={{ fontSize: "var(--text-sm)" }}>{m.name}</strong>
              </div>
              <small style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)" }}>
                {m.rolls.filter((r) => r.isActive).map((r) => `${r.widthIn}″`).join(" · ") || "No active rolls"}
              </small>
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

            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
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

// ── Roll editor row ───────────────────────────────────────────

function RollEditor({ roll }: { roll: MaterialRollWidth }) {
  const [state, action, pending] = useActionState(updateRollAction, {});

  const sqFtCost = () => {
    const area = (parseFloat(roll.widthIn) / 12) * parseFloat(roll.lengthFt);
    const total = parseFloat(roll.rollCost) + parseFloat(roll.handlingCost);
    if (!area || !total) return null;
    return (total / area).toFixed(3);
  };

  return (
    <form
      action={action}
      style={{
        display:      "grid",
        gridTemplateColumns: "auto auto auto auto 1fr auto",
        gap:          "var(--space-3)",
        alignItems:   "end",
        padding:      "var(--space-3)",
        background:   "var(--color-sunken)",
        borderRadius: "var(--radius-md)",
        border:       "1px solid var(--color-border-subtle)",
        opacity:      roll.isActive ? 1 : 0.6,
      }}
    >
      <input type="hidden" name="id" value={roll.id} />

      <div>
        <Label style={{ fontSize: "var(--text-xs)" }}>Width (in.)</Label>
        <Input
          name="widthIn"
          type="number"
          min="0.01"
          step="0.01"
          defaultValue={parseFloat(roll.widthIn).toString()}
          style={{ width: 80 }}
        />
      </div>
      <div>
        <Label style={{ fontSize: "var(--text-xs)" }}>Length (ft.)</Label>
        <Input
          name="lengthFt"
          type="number"
          min="0.01"
          step="0.01"
          defaultValue={parseFloat(roll.lengthFt).toString()}
          style={{ width: 80 }}
        />
      </div>
      <div>
        <Label style={{ fontSize: "var(--text-xs)" }}>Roll cost ($)</Label>
        <Input
          name="rollCost"
          type="number"
          min="0"
          step="0.01"
          defaultValue={parseFloat(roll.rollCost).toString()}
          style={{ width: 90 }}
        />
      </div>
      <div>
        <Label style={{ fontSize: "var(--text-xs)" }}>Handling ($)</Label>
        <Input
          name="handlingCost"
          type="number"
          min="0"
          step="0.01"
          defaultValue={parseFloat(roll.handlingCost).toString()}
          style={{ width: 90 }}
        />
      </div>
      <div style={{ alignSelf: "center" }}>
        {sqFtCost() && (
          <small style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)" }}>
            ${sqFtCost()}/sq ft
          </small>
        )}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)", alignItems: "flex-start" }}>
        <Button type="submit" size="sm" variant="secondary" disabled={pending}>
          {pending ? "…" : "Save"}
        </Button>
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
      {state.error && (
        <div style={{ gridColumn: "1 / -1" }}>
          <Alert variant="danger">{state.error}</Alert>
        </div>
      )}
    </form>
  );
}

// ── Add roll form ─────────────────────────────────────────────

function AddRollForm({ materialId }: { materialId: string }) {
  const [state, action, pending] = useActionState(addRollAction, {});

  return (
    <form
      action={action}
      style={{
        display:      "grid",
        gridTemplateColumns: "auto auto auto auto 1fr auto",
        gap:          "var(--space-3)",
        alignItems:   "end",
        padding:      "var(--space-3)",
        background:   "var(--color-canvas)",
        borderRadius: "var(--radius-md)",
        border:       "1px dashed var(--color-border-default)",
      }}
    >
      <input type="hidden" name="materialId" value={materialId} />

      <div>
        <Label style={{ fontSize: "var(--text-xs)" }}>Width (in.)</Label>
        <Input name="widthIn" type="number" min="0.01" step="0.01" required style={{ width: 80 }} />
      </div>
      <div>
        <Label style={{ fontSize: "var(--text-xs)" }}>Length (ft.)</Label>
        <Input name="lengthFt" type="number" min="0.01" step="0.01" defaultValue="100" required style={{ width: 80 }} />
      </div>
      <div>
        <Label style={{ fontSize: "var(--text-xs)" }}>Roll cost ($)</Label>
        <Input name="rollCost" type="number" min="0" step="0.01" defaultValue="0" required style={{ width: 90 }} />
      </div>
      <div>
        <Label style={{ fontSize: "var(--text-xs)" }}>Handling ($)</Label>
        <Input name="handlingCost" type="number" min="0" step="0.01" defaultValue="0" required style={{ width: 90 }} />
      </div>
      <div />
      <Button type="submit" size="sm" variant="secondary" disabled={pending}>
        {pending ? "Adding…" : "+ Add Roll Size"}
      </Button>
      {state.error && (
        <div style={{ gridColumn: "1 / -1" }}>
          <Alert variant="danger">{state.error}</Alert>
        </div>
      )}
    </form>
  );
}
