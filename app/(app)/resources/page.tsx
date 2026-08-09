import { requireEffectiveUser } from "@/lib/auth";
import { can }         from "@/lib/authz/policy";
import { redirect }    from "next/navigation";
import { listCategories, listResources } from "@/lib/resources/service";
import { ResourceBrowse } from "@/components/resources/resource-browse";

export const metadata = { title: "Resources — Ordering Hub" };

export default async function ResourcesPage() {
  const user = await requireEffectiveUser();
  if (!can(user, "resources:download")) redirect("/dashboard");

  const [categories, resources] = await Promise.all([
    listCategories(),
    listResources(user),
  ]);

  return <ResourceBrowse categories={categories} resources={resources} />;
}
