import { requireUser } from "@/lib/auth";
import { can }         from "@/lib/authz/policy";
import { redirect }    from "next/navigation";
import { listCompanyUsers } from "@/lib/users/service";
import { UserManager } from "@/components/settings/user-manager";
import { inviteCompanyUserAction, updateCompanyUserAction } from "./actions";
import { ROLES } from "@/lib/authz/roles";

export const metadata = { title: "Team — Ordering Hub" };

export default async function CompanyUsersPage() {
  const user = await requireUser();
  if (!can(user, "users:manage_external") || user.role.isInternal || !user.companyId) {
    redirect("/dashboard");
  }

  const users = await listCompanyUsers(user.companyId);

  return (
    <UserManager
      users={users}
      currentUserId={user.id}
      roleOptions={[ROLES.EXTERNAL_ADMIN, ROLES.EXTERNAL_ORDERING, ROLES.EXTERNAL_REFERENCE]}
      canChangeRole={false}
      inviteAction={inviteCompanyUserAction}
      updateAction={updateCompanyUserAction}
    />
  );
}
