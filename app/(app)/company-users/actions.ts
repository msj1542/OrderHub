"use server";

import { revalidatePath } from "next/cache";
import { requireUser, getPreviewContext, assertNotPreview } from "@/lib/auth";
import { can } from "@/lib/authz/policy";
import { createUser, updateCompanyUser } from "@/lib/users/service";
import { ROLES, type RoleCode } from "@/lib/authz/roles";

export type UserState = { error?: string; success?: string };

const INVITABLE_EXTERNAL_ROLES = new Set<RoleCode>([ROLES.EXTERNAL_ADMIN, ROLES.EXTERNAL_ORDERING, ROLES.EXTERNAL_REFERENCE]);

export async function inviteCompanyUserAction(
  _prev: UserState,
  formData: FormData,
): Promise<UserState> {
  const [user, preview] = await Promise.all([requireUser(), getPreviewContext()]);
  if (!can(user, "users:manage_external") || user.role.isInternal || !user.companyId) {
    return { error: "Not authorized." };
  }
  try {
    assertNotPreview(preview);

    const email    = formData.get("email") as string;
    const name     = formData.get("name") as string;
    const roleCode = formData.get("roleCode") as RoleCode;

    if (!INVITABLE_EXTERNAL_ROLES.has(roleCode)) {
      return { error: "Invalid role for company user invite." };
    }

    await createUser({ email, name, roleCode, companyId: user.companyId });
    revalidatePath("/company-users");
    return { success: `Invite sent to ${email}.` };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Invite failed." };
  }
}

export async function updateCompanyUserAction(
  id: string,
  data: { isActive?: boolean },
): Promise<UserState> {
  const [user, preview] = await Promise.all([requireUser(), getPreviewContext()]);
  if (!can(user, "users:manage_external") || user.role.isInternal || !user.companyId) {
    return { error: "Not authorized." };
  }
  try {
    assertNotPreview(preview);
    await updateCompanyUser(id, data, user);
    revalidatePath("/company-users");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Update failed." };
  }
}
