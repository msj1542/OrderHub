"use server";

import { revalidatePath } from "next/cache";
import { requireUser, getPreviewContext, assertNotPreview } from "@/lib/auth";
import { can } from "@/lib/authz/policy";
import { updateOperationsSettings } from "@/lib/settings/service";

export type OperationsState = { error?: string; success?: string };

export async function saveOperationsSettingsAction(
  _prev: OperationsState,
  formData: FormData,
): Promise<OperationsState> {
  const [user, preview] = await Promise.all([requireUser(), getPreviewContext()]);
  if (!can(user, "settings:manage")) return { error: "Not authorized." };
  try {
    assertNotPreview(preview);

    await updateOperationsSettings(
      {
        businessTimezone:    formData.get("businessTimezone") as string,
        rushFeeMode:         formData.get("rushFeeMode") as string,
        rushFeeValue:        parseFloat((formData.get("rushFeeValue") as string) || "0"),
        rushFeeTierMaxPercent: parseFloat((formData.get("rushFeeTierMaxPercent") as string) || "0"),
        rushFeeTierMinPercent: parseFloat((formData.get("rushFeeTierMinPercent") as string) || "0"),
        cutoffWeekday:       formData.get("cutoffWeekday") as string,
        cutoffTime:          formData.get("cutoffTime") as string,
        completionWeekday:   formData.get("completionWeekday") as string,
        completionTime:      formData.get("completionTime") as string,
        completionWeekOffset: (formData.get("completionWeekOffset") as string) || "same",
        duplicateWindowDays: parseInt(formData.get("duplicateWindowDays") as string, 10),
        labelWidthIn:        parseFloat(formData.get("labelWidthIn") as string),
        labelHeightIn:       parseFloat(formData.get("labelHeightIn") as string),
      },
      user.id,
    );
    revalidatePath("/settings/operations");
    return { success: "Settings saved." };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Save failed." };
  }
}
