"use server";

import { revalidatePath }   from "next/cache";
import { requireUser, getPreviewContext, assertNotPreview } from "@/lib/auth";
import { can }              from "@/lib/authz/policy";
import {
  createMaterial,
  updateMaterial,
  addRollWidth,
  updateRollWidth,
} from "@/lib/catalog/service";

// ── Material CRUD ─────────────────────────────────────────────

export type MaterialState = {
  error?: string;
  success?: string;
  newId?: string;
};

export async function saveMaterialAction(
  _prev: MaterialState,
  formData: FormData,
): Promise<MaterialState> {
  const [user, preview] = await Promise.all([requireUser(), getPreviewContext()]);
  if (!can(user, "materials:manage")) return { error: "Not authorized." };

  const id       = formData.get("id") as string | null;
  const code     = (formData.get("code") as string).trim();
  const name     = (formData.get("name") as string).trim();
  const isActive = formData.getAll("isActive").includes("true");

  if (!code || !name) return { error: "Code and name are required." };

  try {
    assertNotPreview(preview);
    if (id) {
      await updateMaterial(id, { code, name, isActive });
      revalidatePath("/settings/materials");
      revalidatePath("/catalog");
      return { success: "Material saved.", newId: id };
    } else {
      const mat = await createMaterial({ code, name, isActive });
      revalidatePath("/settings/materials");
      revalidatePath("/catalog");
      return { success: "Material created.", newId: mat.id };
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Save failed." };
  }
}

// ── Roll width CRUD ───────────────────────────────────────────

export type RollState = {
  error?: string;
  success?: string;
};

export async function addRollAction(
  _prev: RollState,
  formData: FormData,
): Promise<RollState> {
  const [user, preview] = await Promise.all([requireUser(), getPreviewContext()]);
  if (!can(user, "materials:manage")) return { error: "Not authorized." };

  const materialId   = formData.get("materialId") as string;
  const widthIn      = formData.get("widthIn") as string;
  const lengthFt     = formData.get("lengthFt") as string;
  const rollCost     = formData.get("rollCost") as string;
  const handlingCost = formData.get("handlingCost") as string;

  if (!materialId || !widthIn || !lengthFt) {
    return { error: "Material, width, and length are required." };
  }

  const w = parseFloat(widthIn);
  const l = parseFloat(lengthFt);
  const r = parseFloat(rollCost || "0");
  const h = parseFloat(handlingCost || "0");

  if (!Number.isFinite(w) || w <= 0) return { error: "Width must be a positive number." };
  if (!Number.isFinite(l) || l <= 0) return { error: "Length must be a positive number." };

  try {
    assertNotPreview(preview);
    await addRollWidth({
      materialId,
      widthIn:      w.toFixed(4),
      lengthFt:     l.toFixed(4),
      rollCost:     r.toFixed(2),
      handlingCost: h.toFixed(2),
      isActive:     true,
    });
    revalidatePath("/settings/materials");
    return { success: "Roll size added." };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not add roll size." };
  }
}

export async function updateRollAction(
  _prev: RollState,
  formData: FormData,
): Promise<RollState> {
  const [user, preview] = await Promise.all([requireUser(), getPreviewContext()]);
  if (!can(user, "materials:manage")) return { error: "Not authorized." };

  const id           = formData.get("id") as string;
  const widthIn      = formData.get("widthIn") as string;
  const lengthFt     = formData.get("lengthFt") as string;
  const rollCost     = formData.get("rollCost") as string;
  const handlingCost = formData.get("handlingCost") as string;
  const isActive     = formData.getAll("isActive").includes("true");

  if (!id) return { error: "Roll ID is required." };

  try {
    assertNotPreview(preview);
    await updateRollWidth(id, {
      widthIn:      widthIn ? parseFloat(widthIn).toFixed(4) : undefined,
      lengthFt:     lengthFt ? parseFloat(lengthFt).toFixed(4) : undefined,
      rollCost:     rollCost !== undefined ? parseFloat(rollCost).toFixed(2) : undefined,
      handlingCost: handlingCost !== undefined ? parseFloat(handlingCost).toFixed(2) : undefined,
      isActive,
    });
    revalidatePath("/settings/materials");
    return { success: "Roll size updated." };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not update roll size." };
  }
}
