"use server";

import { revalidatePath } from "next/cache";
import { requireUser, getPreviewContext, assertNotPreview } from "@/lib/auth";
import { can } from "@/lib/authz/policy";
import { updateCompany } from "@/lib/companies/service";

export type CompanyDetailsState = { error?: string; success?: string };

/**
 * Self-serve edit for the calling external admin's own company only — the
 * companyId always comes from the session, never from form data, so a
 * company admin can't edit another company by tampering with the request.
 */
export async function saveCompanyDetailsAction(
  _prev: CompanyDetailsState,
  formData: FormData,
): Promise<CompanyDetailsState> {
  const [user, preview] = await Promise.all([requireUser(), getPreviewContext()]);
  if (!can(user, "users:manage_external") || user.role.isInternal || !user.companyId) {
    return { error: "Not authorized." };
  }
  try {
    assertNotPreview(preview);

    const primaryContactName = (formData.get("primaryContactName") as string)?.trim();
    const contactEmail       = (formData.get("contactEmail") as string)?.trim();
    const contactPhone       = (formData.get("contactPhone") as string)?.trim();
    const address             = (formData.get("address") as string)?.trim();

    await updateCompany(user.companyId, {
      primaryContactName: primaryContactName || null,
      contactEmail:       contactEmail || null,
      contactPhone:       contactPhone || null,
      address:            address || null,
    });
    revalidatePath("/settings/company");
    return { success: "Company details saved." };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Save failed." };
  }
}
