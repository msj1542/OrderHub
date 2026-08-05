import { requireUser }   from "@/lib/auth";
import { can }           from "@/lib/authz/policy";
import { redirect }      from "next/navigation";
import { listMaterials } from "@/lib/catalog/service";
import { MaterialSettingsPanel } from "@/components/catalog/material-settings";

export const metadata = { title: "Material Settings — Ordering Hub" };

export default async function MaterialSettingsPage() {
  const user = await requireUser();
  if (!can(user, "materials:manage")) redirect("/dashboard");

  const materials = await listMaterials();

  return <MaterialSettingsPanel materials={materials} />;
}
