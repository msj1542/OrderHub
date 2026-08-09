import { requireUser } from "@/lib/auth";
import { can }         from "@/lib/authz/policy";
import { redirect }    from "next/navigation";
import { listCompanies } from "@/lib/companies/service";
import { listAllCompanyUsers } from "@/lib/users/service";
import { CompanyManager } from "@/components/settings/company-manager";
import { enterPreviewAction } from "@/app/(app)/actions";

export const metadata = { title: "Companies — Ordering Hub" };

export default async function CompaniesSettingsPage() {
  const user = await requireUser();
  if (!can(user, "companies:manage")) redirect("/dashboard");

  const [companies, allUsers] = await Promise.all([
    listCompanies(),
    listAllCompanyUsers(),
  ]);

  const companyUsers: Record<string, typeof allUsers> = {};
  for (const u of allUsers) {
    if (!u.companyId) continue;
    (companyUsers[u.companyId] ??= []).push(u);
  }

  return (
    <CompanyManager
      companies={companies}
      companyUsers={companyUsers}
      currentUserId={user.id}
      canPreview={can(user, "portal:preview")}
      enterPreviewAction={enterPreviewAction}
    />
  );
}
