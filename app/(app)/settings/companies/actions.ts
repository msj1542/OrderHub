"use server";

import { revalidatePath } from "next/cache";
import { requireUser, getPreviewContext, assertNotPreview } from "@/lib/auth";
import { can } from "@/lib/authz/policy";
import { createCompany, updateCompany } from "@/lib/companies/service";

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
    const pricingVisible      = formData.get("pricingVisible") === "true";
    const isActive            = formData.get("isActive") === "true";
    const notes               = (formData.get("notes") as string)?.trim();
    const primaryContactName  = (formData.get("primaryContactName") as string)?.trim();
    const contactEmail        = (formData.get("contactEmail") as string)?.trim();
    const contactPhone        = (formData.get("contactPhone") as string)?.trim();
    const billingNotes        = (formData.get("billingNotes") as string)?.trim();

    if (!name) return { error: "Company name is required." };
    if (orderScope !== "own" && orderScope !== "company") return { error: "Invalid order scope." };

    const values = {
      name, orderScope, pricingVisible, isActive,
      notes:              notes || null,
      primaryContactName: primaryContactName || null,
      contactEmail:       contactEmail || null,
      contactPhone:       contactPhone || null,
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
