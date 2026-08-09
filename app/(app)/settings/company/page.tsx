import { requireUser } from "@/lib/auth";
import { can }         from "@/lib/authz/policy";
import { redirect }    from "next/navigation";
import { CompanyDetailsForm } from "@/components/settings/company-details-form";

export const metadata = { title: "Company — Ordering Hub" };

export default async function ExternalCompanySettingsPage() {
  const user = await requireUser();
  if (!can(user, "users:manage_external") || user.role.isInternal || !user.company) {
    redirect("/dashboard");
  }

  return <CompanyDetailsForm company={user.company} />;
}
