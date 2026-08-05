"use client";

import { useActionState, useState, useTransition } from "react";
import { Button }     from "@/components/ui/button";
import { Input }      from "@/components/ui/input";
import { Label }      from "@/components/ui/label";
import { Textarea }   from "@/components/ui/textarea";
import { Alert }      from "@/components/ui/alert";
import { FieldHint }  from "@/components/ui/field-hint";
import { formatMoney } from "@/lib/pricing/money";
import type { MaterialWithRolls, ProductWithMaterials } from "@/lib/db/schema";
import { saveProductAction, uploadProductFileAction } from "@/app/(app)/settings/catalog/actions";

interface Props {
  product:   ProductWithMaterials;
  materials: MaterialWithRolls[];
}

const INITIAL: { error?: string; success?: string } = {};

export function ProductEditor({ product, materials }: Props) {
  const [saveState, saveAction, savePending] = useActionState(saveProductAction, INITIAL);
  const [uploadState, uploadAction, uploadPending] = useActionState(uploadProductFileAction, INITIAL);

  const [materialIds, setMaterialIds] = useState<string[]>(
    product.materials.map((m) => m.id),
  );

  function toggleMaterial(id: string, checked: boolean) {
    setMaterialIds((prev) => (checked ? [...prev, id] : prev.filter((x) => x !== id)));
  }

  const activeMaterials = materials.filter((m) => m.isActive);

  return (
    <section
      style={{
        background:   "var(--color-panel)",
        border:       "1px solid var(--color-border-default)",
        borderRadius: "var(--radius-lg)",
        overflow:     "hidden",
      }}
    >
      {/* Heading */}
      <div
        style={{
          padding:        "var(--space-5) var(--space-6)",
          borderBottom:   "1px solid var(--color-border-subtle)",
          display:        "flex",
          alignItems:     "center",
          justifyContent: "space-between",
        }}
      >
        <div>
          <p style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: "var(--weight-semibold)" }}>
            Editing
          </p>
          <h3 style={{ fontSize: "var(--text-lg)", margin: "var(--space-1) 0 0" }}>{product.sku}</h3>
        </div>
        <span
          style={{
            padding:      "var(--space-1) var(--space-3)",
            borderRadius: "var(--radius-pill)",
            fontSize:     "var(--text-xs)",
            fontWeight:   "var(--weight-medium)",
            background:   product.customerVisible ? "var(--color-success-subtle)" : "var(--color-neutral-subtle)",
            color:        product.customerVisible ? "var(--color-success)" : "var(--color-text-muted)",
          }}
        >
          {product.customerVisible ? "Customer visible" : "Internal only"}
        </span>
      </div>

      <div style={{ padding: "var(--space-6)" }}>
        {/* Product fields form */}
        <form action={saveAction}>
          <input type="hidden" name="id" value={product.id} />

          {(saveState.error || saveState.success) && (
            <Alert variant={saveState.error ? "danger" : "success"} className="mb-4">
              {saveState.error ?? saveState.success}
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
              <Label htmlFor="brand">Brand</Label>
              <Input id="brand" name="brand" defaultValue={product.brand} required />
            </div>
            <div>
              <Label htmlFor="model">Model</Label>
              <Input id="model" name="model" defaultValue={product.model} required />
            </div>
            <div>
              <Label htmlFor="yearStart">Start year</Label>
              <Input id="yearStart" name="yearStart" defaultValue={product.yearStart ?? ""} />
            </div>
            <div>
              <Label htmlFor="partName">Part name</Label>
              <Input id="partName" name="partName" defaultValue={product.partName} required />
            </div>
            <div>
              <Label htmlFor="attr1">Attribute 1</Label>
              <Input id="attr1" name="attr1" defaultValue={product.attr1 ?? ""} />
            </div>
            <div>
              <Label htmlFor="attr2">Attribute 2</Label>
              <Input id="attr2" name="attr2" defaultValue={product.attr2 ?? ""} />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" name="description" rows={3} defaultValue={product.description} required />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <Label htmlFor="includedPieces">Included pieces</Label>
              <Input id="includedPieces" name="includedPieces" defaultValue={product.includedPieces ?? ""} />
            </div>
            <div>
              <Label htmlFor="patternLengthIn" style={{ display: "flex", alignItems: "center", gap: "var(--space-1)" }}>
                Pattern length (inches)
                <FieldHint text="The horizontal extent of the cut pattern. Production adds a 1″ buffer per piece." />
              </Label>
              <Input
                id="patternLengthIn"
                name="patternLengthIn"
                type="number"
                min="0.01"
                step="0.01"
                defaultValue={product.patternLengthIn ?? ""}
              />
            </div>
            <div>
              <Label htmlFor="requiredRollWidthIn" style={{ display: "flex", alignItems: "center", gap: "var(--space-1)" }}>
                Required roll width (inches)
                <FieldHint text="Ordering selects the narrowest active roll that is at least this wide." />
              </Label>
              <Input
                id="requiredRollWidthIn"
                name="requiredRollWidthIn"
                type="number"
                min="0.01"
                step="0.01"
                defaultValue={product.requiredRollWidthIn ?? ""}
              />
            </div>
          </div>

          {/* Material compatibility */}
          <fieldset
            style={{
              border:       "1px solid var(--color-border-default)",
              borderRadius: "var(--radius-md)",
              padding:      "var(--space-4)",
              marginBottom: "var(--space-5)",
            }}
          >
            <legend
              style={{
                padding:    "0 var(--space-2)",
                fontSize:   "var(--text-sm)",
                fontWeight: "var(--weight-semibold)",
              }}
            >
              Compatible materials and selling prices
            </legend>
            <p style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", marginTop: 0, marginBottom: "var(--space-4)" }}>
              Select every material approved for this kit. A material is offered during ordering only when a wide-enough active roll and a selling price are both available.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "var(--space-3)" }}>
              {activeMaterials.map((mat) => {
                const checked = materialIds.includes(mat.id);
                const required = product.requiredRollWidthIn ? parseFloat(product.requiredRollWidthIn) : 0;
                const suitableRoll = required > 0
                  ? mat.rolls.filter((r) => r.isActive && parseFloat(r.widthIn) >= required).sort((a, b) => parseFloat(a.widthIn) - parseFloat(b.widthIn))[0]
                  : mat.rolls.filter((r) => r.isActive)[0];
                const currentPrice = product.prices.find((p) => p.materialId === mat.id);

                return (
                  <div
                    key={mat.id}
                    style={{
                      padding:      "var(--space-3)",
                      border:       `1px solid ${checked ? "var(--color-brand)" : "var(--color-border-default)"}`,
                      borderRadius: "var(--radius-md)",
                      background:   checked ? "var(--color-brand-subtle)" : "var(--color-canvas)",
                    }}
                  >
                    <label style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", marginBottom: "var(--space-2)", cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        name="materialIds"
                        value={mat.id}
                        checked={checked}
                        onChange={(e) => toggleMaterial(mat.id, e.target.checked)}
                      />
                      <span style={{ fontSize: "var(--text-sm)", fontWeight: "var(--weight-medium)" }}>{mat.name}</span>
                    </label>
                    <div>
                      <Label htmlFor={`price-${mat.id}`} style={{ fontSize: "var(--text-xs)" }}>
                        Selling price
                      </Label>
                      <Input
                        id={`price-${mat.id}`}
                        name={`price_${mat.id}`}
                        type="number"
                        min="0"
                        step="0.01"
                        disabled={!checked}
                        defaultValue={currentPrice ? parseFloat(currentPrice.unitPrice).toFixed(2) : ""}
                        placeholder="0.00"
                        style={{ fontSize: "var(--text-sm)" }}
                      />
                    </div>
                    <small
                      style={{
                        display:    "block",
                        marginTop:  "var(--space-1)",
                        fontSize:   "var(--text-xs)",
                        color:      suitableRoll ? "var(--color-success)" : "var(--color-warning)",
                      }}
                    >
                      {suitableRoll
                        ? `Uses ${suitableRoll.widthIn}″ × ${suitableRoll.lengthFt}′ roll`
                        : required > 0
                          ? "No active roll is wide enough"
                          : "No active rolls configured"}
                    </small>
                  </div>
                );
              })}
            </div>
          </fieldset>

          {/* Price revision */}
          <div
            style={{
              display:             "grid",
              gridTemplateColumns: "repeat(2, 1fr)",
              gap:                 "var(--space-4)",
              marginBottom:        "var(--space-5)",
            }}
          >
            <div>
              <Label htmlFor="revision">Price revision</Label>
              <Input id="revision" name="revision" defaultValue={product.priceListRevision ?? "manual"} />
            </div>
            <div>
              <Label htmlFor="effectiveDate">Effective date</Label>
              <Input
                id="effectiveDate"
                name="effectiveDate"
                type="date"
                defaultValue={product.priceEffectiveDate ?? new Date().toISOString().slice(0, 10)}
              />
            </div>
          </div>

          {/* Toggles */}
          <div style={{ display: "flex", gap: "var(--space-6)", marginBottom: "var(--space-5)" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", cursor: "pointer" }}>
              <input type="hidden" name="customerVisible" value="false" />
              <input
                type="checkbox"
                name="customerVisible"
                value="true"
                defaultChecked={product.customerVisible}
                onChange={(e) => {
                  const hidden = e.currentTarget.previousElementSibling as HTMLInputElement;
                  hidden.disabled = e.currentTarget.checked;
                }}
              />
              <span style={{ fontSize: "var(--text-sm)" }}>Show to customers</span>
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", cursor: "pointer" }}>
              <input type="hidden" name="isActive" value="false" />
              <input
                type="checkbox"
                name="isActive"
                value="true"
                defaultChecked={product.isActive}
                onChange={(e) => {
                  const hidden = e.currentTarget.previousElementSibling as HTMLInputElement;
                  hidden.disabled = e.currentTarget.checked;
                }}
              />
              <span style={{ fontSize: "var(--text-sm)" }}>Active product</span>
            </label>
          </div>

          <Button type="submit" disabled={savePending}>
            {savePending ? "Saving…" : "Save Product"}
          </Button>
        </form>

        {/* File upload section */}
        <div
          style={{
            marginTop:  "var(--space-8)",
            paddingTop: "var(--space-6)",
            borderTop:  "1px solid var(--color-border-subtle)",
          }}
        >
          <h4 style={{ fontSize: "var(--text-base)", fontWeight: "var(--weight-semibold)", marginBottom: "var(--space-4)" }}>
            Attach thumbnail or product file
          </h4>

          {(uploadState.error || uploadState.success) && (
            <Alert variant={uploadState.error ? "danger" : "success"} className="mb-4">
              {uploadState.error ?? uploadState.success}
            </Alert>
          )}

          <form action={uploadAction}>
            <input type="hidden" name="productId" value={product.id} />
            <div
              style={{
                display:             "grid",
                gridTemplateColumns: "repeat(2, 1fr)",
                gap:                 "var(--space-4)",
                marginBottom:        "var(--space-4)",
              }}
            >
              <div>
                <Label htmlFor="upload-label">Display title</Label>
                <Input
                  id="upload-label"
                  name="label"
                  required
                  placeholder="Kit PDF, Layout PDF, Tack Diagram…"
                />
              </div>
              <div>
                <Label htmlFor="upload-file">File</Label>
                <Input
                  id="upload-file"
                  name="file"
                  type="file"
                  required
                  accept="image/*,.pdf,.png,.jpg,.jpeg,.doc,.docx,.zip"
                />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", cursor: "pointer" }}>
                  <input type="hidden" name="isThumbnail" value="false" />
                  <input type="checkbox" name="isThumbnail" value="true" />
                  <span style={{ fontSize: "var(--text-sm)" }}>Use this image as the product thumbnail</span>
                </label>
              </div>
            </div>
            <Button type="submit" variant="secondary" disabled={uploadPending}>
              {uploadPending ? "Uploading…" : "Upload & Associate"}
            </Button>
          </form>

          {/* Associated files */}
          {product.prices.length === 0 && product.materials.length === 0 && (
            <p style={{ fontSize: "var(--text-sm)", color: "var(--color-text-muted)", marginTop: "var(--space-4)" }}>
              No files associated yet.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
