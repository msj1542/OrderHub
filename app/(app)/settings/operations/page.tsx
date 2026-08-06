import { requireUser } from "@/lib/auth";
import { can }         from "@/lib/authz/policy";
import { redirect }    from "next/navigation";
import { getSettings } from "@/lib/settings/schedule";
import { OperationsSettingsPanel } from "@/components/settings/operations-settings-panel";

export const metadata = { title: "Operations — Ordering Hub" };

export default async function OperationsSettingsPage() {
  const user = await requireUser();
  if (!can(user, "settings:manage")) redirect("/dashboard");

  const settings = await getSettings();

  return <OperationsSettingsPanel settings={settings} />;
}
