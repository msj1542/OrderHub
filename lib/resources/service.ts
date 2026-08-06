/**
 * Resource library service — categories, documents, and versioned files.
 *
 * Architecture: service-role Drizzle connection (bypasses RLS). Scoping for
 * external users (active + customer-visible + pricing-restricted gate)
 * mirrors the `resources_select_external` RLS policy in
 * supabase/migrations/0006_phase6.sql exactly — keep the two in sync.
 */

import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  resources, resourceCategories, resourceVersions,
  type AppUser, type ResourceCategory, type ResourceWithVersion, type ResourceFull,
  type NewResourceCategory,
} from "@/lib/db/schema";
import { canExternalUserSeeResource } from "@/lib/resources/visibility";

// ── Categories ───────────────────────────────────────────────

export async function listCategories(): Promise<ResourceCategory[]> {
  return db.select().from(resourceCategories).orderBy(asc(resourceCategories.sortOrder), asc(resourceCategories.name));
}

export async function createCategory(data: NewResourceCategory): Promise<ResourceCategory> {
  const [row] = await db.insert(resourceCategories).values(data).returning();
  return row;
}

export async function updateCategory(
  id: string,
  data: Partial<Pick<ResourceCategory, "name" | "pricingRestricted" | "sortOrder">>,
): Promise<ResourceCategory> {
  const [row] = await db.update(resourceCategories).set(data).where(eq(resourceCategories.id, id)).returning();
  return row;
}

// ── Resources ────────────────────────────────────────────────

export async function listResources(
  user: AppUser,
  filters: { categoryId?: string } = {},
): Promise<ResourceWithVersion[]> {
  const conditions = [];
  if (filters.categoryId) conditions.push(eq(resources.categoryId, filters.categoryId));

  const rows = await db
    .select({ resource: resources, categoryName: resourceCategories.name })
    .from(resources)
    .innerJoin(resourceCategories, eq(resourceCategories.id, resources.categoryId))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(resources.createdAt));

  const filtered = user.role.isInternal
    ? rows
    : rows.filter((r) => canExternalUserSeeResource(r.resource, { pricingVisible: user.company?.pricingVisible ?? false }));

  if (!filtered.length) return [];

  const resourceIds = filtered.map((r) => r.resource.id);
  const allVersions = await db
    .select()
    .from(resourceVersions)
    .orderBy(desc(resourceVersions.createdAt));
  const versionsById = new Map(allVersions.map((v) => [v.id, v]));
  const countByResource = new Map<string, number>();
  for (const v of allVersions) {
    if (!resourceIds.includes(v.resourceId)) continue;
    countByResource.set(v.resourceId, (countByResource.get(v.resourceId) ?? 0) + 1);
  }

  return filtered.map(({ resource, categoryName }) => ({
    ...resource,
    categoryName,
    currentVersion: resource.currentVersionId ? versionsById.get(resource.currentVersionId) ?? null : null,
    versionCount:   countByResource.get(resource.id) ?? 0,
  }));
}

export async function getResource(id: string, user: AppUser): Promise<ResourceFull | null> {
  const [row] = await db
    .select({ resource: resources, categoryName: resourceCategories.name })
    .from(resources)
    .innerJoin(resourceCategories, eq(resourceCategories.id, resources.categoryId))
    .where(eq(resources.id, id))
    .limit(1);
  if (!row) return null;

  const { resource, categoryName } = row;
  if (!user.role.isInternal && !canExternalUserSeeResource(resource, { pricingVisible: user.company?.pricingVisible ?? false })) {
    return null;
  }

  const versions = await db
    .select()
    .from(resourceVersions)
    .where(eq(resourceVersions.resourceId, id))
    .orderBy(desc(resourceVersions.createdAt));

  const currentVersion = resource.currentVersionId
    ? versions.find((v) => v.id === resource.currentVersionId) ?? null
    : null;

  return { ...resource, categoryName, currentVersion, versionCount: versions.length, versions };
}

export async function createResource(data: {
  categoryId:        string;
  title:             string;
  description?:      string;
  productId?:        string;
  customerVisible?:  boolean;
  pricingRestricted?: boolean;
}): Promise<{ id: string }> {
  const [row] = await db
    .insert(resources)
    .values({
      categoryId:        data.categoryId,
      title:             data.title.trim(),
      description:       data.description?.trim() || null,
      productId:         data.productId || null,
      customerVisible:   data.customerVisible ?? true,
      pricingRestricted: data.pricingRestricted ?? false,
    })
    .returning({ id: resources.id });
  return row;
}

export async function updateResource(
  id: string,
  data: Partial<{
    title: string; description: string | null; categoryId: string;
    isActive: boolean; customerVisible: boolean; pricingRestricted: boolean;
  }>,
): Promise<void> {
  await db.update(resources).set({ ...data, updatedAt: new Date() }).where(eq(resources.id, id));
}

/** Upload a new version and make it the resource's current version. */
export async function addResourceVersion(
  resourceId: string,
  data: { version?: string; filePath: string; fileName: string; mimeType?: string },
  uploadedBy: string,
): Promise<void> {
  await db.transaction(async (tx) => {
    const [version] = await tx
      .insert(resourceVersions)
      .values({
        resourceId,
        version:   data.version?.trim() || null,
        filePath:  data.filePath,
        fileName:  data.fileName,
        mimeType:  data.mimeType,
        uploadedBy,
      })
      .returning({ id: resourceVersions.id });

    await tx
      .update(resources)
      .set({ currentVersionId: version.id, updatedAt: new Date() })
      .where(eq(resources.id, resourceId));
  });
}
