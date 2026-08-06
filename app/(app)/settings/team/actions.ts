"use server";

import { revalidatePath } from "next/cache";
import { requireUser, getPreviewContext, assertNotPreview } from "@/lib/auth";
import { can } from "@/lib/authz/policy";
import { createUser, updateUser } from "@/lib/users/service";
import { INTERNAL_ROLES, type RoleCode } from "@/lib/authz/roles";

export type UserState = { error?: string; success?: string };

export async function inviteInternalUserAction(
  _prev: UserState,
  formData: FormData,
): Promise<UserState> {
  const [user, preview] = await Promise.all([requireUser(), getPreviewContext()]);
  if (!can(user, "users:manage_internal")) return { error: "Not authorized." };
  try {
    assertNotPreview(preview);

    const email    = formData.get("email") as string;
    const name     = formData.get("name") as string;
    const roleCode = formData.get("roleCode") as RoleCode;

    if (!INTERNAL_ROLES.has(roleCode)) return { error: "Select a valid internal role." };

    await createUser({ email, name, roleCode });
    revalidatePath("/settings/team");
    return { success: `Invite sent to ${email}.` };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Invite failed." };
  }
}

export async function updateInternalUserAction(
  id: string,
  data: { roleCode?: RoleCode; isActive?: boolean },
): Promise<UserState> {
  const [user, preview] = await Promise.all([requireUser(), getPreviewContext()]);
  if (!can(user, "users:manage_internal")) return { error: "Not authorized." };
  try {
    assertNotPreview(preview);
    await updateUser(id, data, user);
    revalidatePath("/settings/team");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Update failed." };
  }
}
