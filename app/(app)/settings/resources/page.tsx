import { requireUser } from "@/lib/auth";
import { can }         from "@/lib/authz/policy";
import { redirect }    from "next/navigation";
import { listCategories, listResources } from "@/lib/resources/service";
import { ResourceManager } from "@/components/resources/resource-manager";

export const metadata = { title: "Resource Settings — Ordering Hub" };

export default async function ResourceSettingsPage() {
  const user = await requireUser();
  if (!can(user, "resources:manage")) redirect("/dashboard");

  const [categories, resources] = await Promise.all([
    listCategories(),
    listResources(user),
  ]);

  return <ResourceManager categories={categories} resources={resources} />;
}
