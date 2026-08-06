import { requireUser } from "@/lib/auth";
import { can }         from "@/lib/authz/policy";
import { redirect }    from "next/navigation";
import { listInternalUsers } from "@/lib/users/service";
import { UserManager } from "@/components/settings/user-manager";
import { inviteInternalUserAction, updateInternalUserAction } from "./actions";
import { INTERNAL_ROLES } from "@/lib/authz/roles";

export const metadata = { title: "Team — Ordering Hub" };

export default async function InternalTeamPage() {
  const user = await requireUser();
  if (!can(user, "users:manage_internal")) redirect("/dashboard");

  const users = await listInternalUsers();

  return (
    <UserManager
      users={users}
      currentUserId={user.id}
      roleOptions={[...INTERNAL_ROLES]}
      canChangeRole
      inviteAction={inviteInternalUserAction}
      updateAction={updateInternalUserAction}
    />
  );
}
