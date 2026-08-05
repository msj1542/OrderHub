import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { users, roles, companies } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import type { AppUser } from "@/lib/db/schema";

// ── Session helpers ───────────────────────────────────────────

/**
 * Returns the current authenticated AppUser, or null if not signed in
 * or if the auth_user_id has no corresponding public.users row yet.
 */
export async function getUser(): Promise<AppUser | null> {
  const supabase = await createClient();
  const {
    data: { user: authUser },
    error,
  } = await supabase.auth.getUser();

  if (error || !authUser) return null;

  const rows = await db
    .select()
    .from(users)
    .innerJoin(roles,    eq(roles.roleCode,    users.roleCode))
    .leftJoin(companies, eq(companies.id,      users.companyId))
    .where(eq(users.authUserId, authUser.id))
    .limit(1);

  if (!rows.length) return null;

  const { users: u, roles: r, companies: c } = rows[0];
  if (!u.isActive) return null;

  return { ...u, role: r, company: c ?? null };
}

/**
 * Like getUser(), but redirects to /login if no valid session.
 * Use in every (app) route/layout that requires authentication.
 */
export async function requireUser(): Promise<AppUser> {
  const user = await getUser();
  if (!user) redirect("/login");
  return user;
}

// ── Portal preview mode ───────────────────────────────────────

export type PreviewContext = {
  companyId:   string;
  companyName: string;
  roleCode:    string;
};

const PREVIEW_COOKIE = "orderhub_preview";

/**
 * Returns the active portal preview context, or null if not in preview mode.
 * The preview context is set by the PortalPreviewModal (Phase 6).
 */
export async function getPreviewContext(): Promise<PreviewContext | null> {
  const jar = await cookies();
  const raw = jar.get(PREVIEW_COOKIE)?.value;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PreviewContext;
  } catch {
    return null;
  }
}

/**
 * Throws if a Server Action is called while in portal preview mode.
 * Call at the top of every Server Action that writes data.
 */
export function assertNotPreview(preview: PreviewContext | null): void {
  if (preview) {
    throw new Error(
      "This action is not available in portal preview mode."
    );
  }
}

/**
 * Returns the effective rendering context — the real user for mutations,
 * and either the real user or the preview overlay for display.
 */
export async function getEffectiveContext(user: AppUser): Promise<{
  viewAsRoleCode:    string;
  viewAsCompanyId:   string | null;
  viewAsCompanyName: string | null;
  isPreview:         boolean;
}> {
  const preview = await getPreviewContext();
  if (preview) {
    return {
      viewAsRoleCode:    preview.roleCode,
      viewAsCompanyId:   preview.companyId,
      viewAsCompanyName: preview.companyName,
      isPreview:         true,
    };
  }
  return {
    viewAsRoleCode:    user.roleCode,
    viewAsCompanyId:   user.companyId,
    viewAsCompanyName: user.company?.name ?? null,
    isPreview:         false,
  };
}
