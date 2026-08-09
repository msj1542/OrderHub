"use server";

import { revalidatePath } from "next/cache";
import { requireUser, getPreviewContext, assertNotPreview } from "@/lib/auth";
import { can } from "@/lib/authz/policy";
import { createCompany, updateCompany } from "@/lib/companies/service";
import { createUser } from "@/lib/users/service";
import { ROLES, type RoleCode } from "@/lib/authz/roles";

export type CompanyState = { error?: string; success?: string; newId?: string };

export async function saveCompanyAction(
  _prev: CompanyState,
  formData: FormData,
): Promise<CompanyState> {
  const [user, preview] = await Promise.all([requireUser(), getPreviewContext()]);
  if (!can(user, "companies:manage")) return { error: "Not authorized." };
  try {
    assertNotPreview(preview);

    const id                 = (formData.get("id") as string) || null;
    const name                = (formData.get("name") as string)?.trim();
    const orderScope          = formData.get("orderScope") as string;
    const pricingVisible      = formData.getAll("pricingVisible").includes("true");
    const isActive            = formData.getAll("isActive").includes("true");
    const notes               = (formData.get("notes") as string)?.trim();
    const primaryContactName  = (formData.get("primaryContactName") as string)?.trim();
    const contactEmail        = (formData.get("contactEmail") as string)?.trim();
    const contactPhone        = (formData.get("contactPhone") as string)?.trim();
    const address              = (formData.get("address") as string)?.trim();
    const billingNotes        = (formData.get("billingNotes") as string)?.trim();

    if (!name) return { error: "Company name is required." };
    if (orderScope !== "own" && orderScope !== "company") return { error: "Invalid order scope." };

    const values = {
      name, orderScope, pricingVisible, isActive,
      notes:              notes || null,
      primaryContactName: primaryContactName || null,
      contactEmail:       contactEmail || null,
      contactPhone:       contactPhone || null,
      address:            address || null,
      billingNotes:       billingNotes || null,
    };

    if (id) {
      await updateCompany(id, values);
      revalidatePath("/settings/companies");
      return { success: "Company saved.", newId: id };
    } else {
      const created = await createCompany(values);
      revalidatePath("/settings/companies");
      return { success: "Company created.", newId: created.id };
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Save failed." };
  }
}

const INVITABLE_EXTERNAL_ROLES = new Set<RoleCode>([
  ROLES.EXTERNAL_ADMIN, ROLES.EXTERNAL_ORDERING, ROLES.EXTERNAL_REFERENCE,
]);

export type InviteUserState = { error?: string; success?: string };

/**
 * Internal-admin path for creating a company's first user (typically its
 * external_admin) — the self-service invite in /company-users requires an
 * existing external_admin to invoke it, which a brand-new company doesn't
 * have yet.
 */
export async function inviteExternalAdminAction(
  _prev: InviteUserState,
  formData: FormData,
): Promise<InviteUserState> {
  const [user, preview] = await Promise.all([requireUser(), getPreviewContext()]);
  if (!can(user, "companies:manage")) return { error: "Not authorized." };
  try {
    assertNotPreview(preview);

    const companyId = formData.get("companyId") as string;
    const email      = formData.get("email") as string;
    const name       = formData.get("name") as string;
    const roleCode   = formData.get("roleCode") as RoleCode;

    if (!companyId) return { error: "Save the company before inviting a user." };
    if (!INVITABLE_EXTERNAL_ROLES.has(roleCode)) return { error: "Invalid role for company user invite." };

    await createUser({ email, name, roleCode, companyId });
    revalidatePath("/settings/companies");
    return { success: `Invite sent to ${email}.` };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Invite failed." };
  }
}
