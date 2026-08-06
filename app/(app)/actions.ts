"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/authz/policy";
import { EXTERNAL_ROLES, type RoleCode } from "@/lib/authz/roles";
import type { PreviewContext } from "@/lib/auth";

export async function exitPreviewAction() {
  const jar = await cookies();
  jar.delete("orderhub_preview");
  redirect("/dashboard");
}

/** Enter read-only portal preview as a given company + external role. Admin only. */
export async function enterPreviewAction(companyId: string, companyName: string, roleCode: string) {
  const user = await requireUser();
  if (!can(user, "portal:preview")) throw new Error("Not authorized.");
  if (!EXTERNAL_ROLES.has(roleCode as RoleCode)) throw new Error("Preview role must be an external role.");

  const context: PreviewContext = { companyId, companyName, roleCode };
  const jar = await cookies();
  jar.set("orderhub_preview", JSON.stringify(context), {
    httpOnly: true,
    sameSite: "lax",
    path:     "/",
  });
  redirect("/dashboard");
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
