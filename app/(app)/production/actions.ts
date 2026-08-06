"use server";

import { revalidatePath } from "next/cache";
import { requireUser, getPreviewContext, assertNotPreview } from "@/lib/auth";
import {
  claimWorkOrder,
  updatePieceProgress,
  recordRecut,
  submitQC,
} from "@/lib/production/service";

type Result = { error?: string | null };

export async function claimWorkOrderAction(workOrderId: string): Promise<Result> {
  try {
    const [user, preview] = await Promise.all([requireUser(), getPreviewContext()]);
    assertNotPreview(preview);
    await claimWorkOrder(workOrderId, user);
    revalidatePath("/production");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Action failed." };
  }
}

export async function updatePieceProgressAction(
  workOrderId: string,
  orderLineId: string,
  completedPieces: number[],
): Promise<Result> {
  try {
    const [user, preview] = await Promise.all([requireUser(), getPreviewContext()]);
    assertNotPreview(preview);
    await updatePieceProgress(workOrderId, orderLineId, completedPieces, user);
    revalidatePath("/production");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to update progress." };
  }
}

export async function recordRecutAction(
  workOrderId: string,
  orderLineId: string,
  quantity: number,
  reason: string,
): Promise<Result> {
  try {
    const [user, preview] = await Promise.all([requireUser(), getPreviewContext()]);
    assertNotPreview(preview);
    await recordRecut(workOrderId, orderLineId, quantity, reason, user);
    revalidatePath("/production");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to record recut." };
  }
}

export async function submitQCAction(
  workOrderId: string,
  answers: Record<string, boolean>,
  notes: string | null,
): Promise<Result> {
  try {
    const [user, preview] = await Promise.all([requireUser(), getPreviewContext()]);
    assertNotPreview(preview);
    await submitQC(workOrderId, answers, notes, user);
    revalidatePath("/production");
    revalidatePath("/orders");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to submit QC." };
  }
}
