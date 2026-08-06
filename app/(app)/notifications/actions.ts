"use server";

import { revalidatePath } from "next/cache";
import { requireUser, getPreviewContext, assertNotPreview } from "@/lib/auth";
import { markNotificationRead, markAllNotificationsRead } from "@/lib/notifications/service";

type Result = { error?: string };

export async function markNotificationReadAction(notificationId: string): Promise<Result> {
  try {
    const [user, preview] = await Promise.all([requireUser(), getPreviewContext()]);
    assertNotPreview(preview);
    await markNotificationRead(notificationId, user);
    revalidatePath("/notifications");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Action failed." };
  }
}

export async function markAllNotificationsReadAction(): Promise<Result> {
  try {
    const [user, preview] = await Promise.all([requireUser(), getPreviewContext()]);
    assertNotPreview(preview);
    await markAllNotificationsRead(user);
    revalidatePath("/notifications");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Action failed." };
  }
}
