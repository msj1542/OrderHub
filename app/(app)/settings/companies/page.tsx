import { requireUser } from "@/lib/auth";
import { can }         from "@/lib/authz/policy";
import { redirect }    from "next/navigation";
import { listCompanies } from "@/lib/companies/service";
import { CompanyManager } from "@/components/settings/company-manager";
import { enterPreviewAction } from "@/app/(app)/actions";

export const metadata = { title: "Companies — Ordering Hub" };

export default async function CompaniesSettingsPage() {
  const user = await requireUser();
  if (!can(user, "companies:manage")) redirect("/dashboard");

  const companies = await listCompanies();

  return (
    <CompanyManager
      companies={companies}
      canPreview={can(user, "portal:preview")}
      enterPreviewAction={enterPreviewAction}
    />
  );
}
