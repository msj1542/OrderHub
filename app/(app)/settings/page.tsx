import { requireUser } from "@/lib/auth";
import { redirect }    from "next/navigation";

export default async function SettingsIndexPage() {
  const user = await requireUser();
  redirect(user.role.isInternal ? "/settings/companies" : "/settings/company");
}
