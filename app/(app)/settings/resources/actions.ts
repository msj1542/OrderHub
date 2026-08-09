"use server";

import { revalidatePath } from "next/cache";
import { requireUser, getPreviewContext, assertNotPreview } from "@/lib/auth";
import { can } from "@/lib/authz/policy";
import { createClient } from "@/lib/supabase/server";
import {
  createCategory, updateCategory,
  createResource, updateResource, addResourceVersion,
} from "@/lib/resources/service";

// ── Categories ───────────────────────────────────────────────

export type CategoryState = { error?: string; success?: string };

export async function saveCategoryAction(
  _prev: CategoryState,
  formData: FormData,
): Promise<CategoryState> {
  const [user, preview] = await Promise.all([requireUser(), getPreviewContext()]);
  if (!can(user, "resources:manage")) return { error: "Not authorized." };
  try {
    assertNotPreview(preview);

    const id                = (formData.get("id") as string) || null;
    const name               = (formData.get("name") as string)?.trim();
    const pricingRestricted  = formData.getAll("pricingRestricted").includes("true");

    if (!name) return { error: "Category name is required." };

    if (id) {
      await updateCategory(id, { name, pricingRestricted });
    } else {
      await createCategory({ name, pricingRestricted });
    }
    revalidatePath("/settings/resources");
    revalidatePath("/resources");
    return { success: "Category saved." };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Save failed." };
  }
}

// ── Resources ────────────────────────────────────────────────

export type ResourceState = { error?: string; success?: string; newId?: string };

export async function saveResourceAction(
  _prev: ResourceState,
  formData: FormData,
): Promise<ResourceState> {
  const [user, preview] = await Promise.all([requireUser(), getPreviewContext()]);
  if (!can(user, "resources:manage")) return { error: "Not authorized." };
  try {
    assertNotPreview(preview);

    const id                = (formData.get("id") as string) || null;
    const categoryId        = formData.get("categoryId") as string;
    const title              = (formData.get("title") as string)?.trim();
    const description        = (formData.get("description") as string)?.trim();
    const isActive            = formData.getAll("isActive").includes("true");
    const pricingRestricted   = formData.getAll("pricingRestricted").includes("true");
    // Single "External access" control (download / view-only / internal-only)
    // maps to the two underlying columns — see resource-manager.tsx.
    const access = (formData.get("access") as string) || "download";
    const customerVisible = access !== "internal_only";
    const downloadable    = access !== "view_only";

    if (!categoryId || !title) return { error: "Category and title are required." };

    if (id) {
      await updateResource(id, { categoryId, title, description: description || null, isActive, customerVisible, pricingRestricted, downloadable });
      revalidatePath("/settings/resources");
      revalidatePath("/resources");
      return { success: "Resource saved.", newId: id };
    } else {
      const created = await createResource({ categoryId, title, description, customerVisible, pricingRestricted, downloadable });
      revalidatePath("/settings/resources");
      revalidatePath("/resources");
      return { success: "Resource created.", newId: created.id };
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Save failed." };
  }
}

// ── Upload a new version ────────────────────────────────────────

export type UploadVersionState = { error?: string; success?: string };

export async function uploadResourceVersionAction(
  _prev: UploadVersionState,
  formData: FormData,
): Promise<UploadVersionState> {
  const [user, preview] = await Promise.all([requireUser(), getPreviewContext()]);
  if (!can(user, "resources:manage")) return { error: "Not authorized." };

  const resourceId = formData.get("resourceId") as string;
  const version     = (formData.get("version") as string) || "";
  const file        = formData.get("file") as File | null;

  if (!resourceId || !file) return { error: "A file is required." };

  try {
    assertNotPreview(preview);

    const supabase = await createClient();
    const ext      = file.name.split(".").pop();
    const filePath = `resources/${resourceId}/${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("resources")
      .upload(filePath, file, { contentType: file.type, upsert: false });
    if (uploadError) throw new Error(uploadError.message);

    await addResourceVersion(
      resourceId,
      { version, filePath, fileName: file.name, mimeType: file.type },
      user.id,
    );

    revalidatePath("/settings/resources");
    revalidatePath("/resources");
    return { success: "Version uploaded." };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Upload failed." };
  }
}
