import { requireEffectiveUser } from "@/lib/auth";
import { can } from "@/lib/authz/policy";
import { redirect } from "next/navigation";
import { getCompatibilityData } from "@/lib/compatibility/service";
import { CompatibilityBrowse } from "@/components/compatibility/compatibility-browse";

export const metadata = { title: "Compatibility — Ordering Hub" };

export default async function CompatibilityPage() {
  const user = await requireEffectiveUser();
  if (!can(user, "catalog:view")) redirect("/dashboard");

  const data = await getCompatibilityData({ isInternal: user.role.isInternal });

  return <CompatibilityBrowse {...data} />;
}
