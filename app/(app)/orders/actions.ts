"use server";

import { revalidatePath } from "next/cache";
import { requireUser, getPreviewContext, assertNotPreview } from "@/lib/auth";
import {
  acceptOrder,
  claimOrder,
  cancelOrder,
  requestCancellation,
  declineCancellation,
  deleteDraft,
  addComment,
  invoiceVerifyOrder,
  releaseOrder,
  submitDraft,
} from "@/lib/orders/service";
import type { InvoiceVerificationInput } from "@/lib/orders/invoiceVerification";

type Result = { error?: string | null; message?: string };

// ── Accept / generic status advance ───────────────────────────

export async function acceptOrderAction(
  orderId: string,
  action: "accept" | "claim" | "release",
  expectedCompletionDate?: string,
  requestedDate?: string,
): Promise<Result> {
  try {
    const [user, preview] = await Promise.all([requireUser(), getPreviewContext()]);
    assertNotPreview(preview);

    if (action === "accept") {
      await acceptOrder(orderId, user, expectedCompletionDate, requestedDate);
    } else if (action === "claim") {
      await claimOrder(orderId, user);
    } else if (action === "release") {
      await releaseOrder(orderId, user);
    }

    revalidatePath("/orders");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Action failed." };
  }
}

// ── Invoice verification ───────────────────────────────────────

export async function invoiceVerifyAction(
  orderId: string,
  input: InvoiceVerificationInput,
): Promise<Result> {
  try {
    const [user, preview] = await Promise.all([requireUser(), getPreviewContext()]);
    assertNotPreview(preview);
    await invoiceVerifyOrder(orderId, input, user);
    revalidatePath("/orders");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Action failed." };
  }
}

// ── Cancel (internal coordinator) ─────────────────────────────

export async function cancelOrderAction(orderId: string, reason: string): Promise<Result> {
  try {
    const [user, preview] = await Promise.all([requireUser(), getPreviewContext()]);
    assertNotPreview(preview);
    await cancelOrder(orderId, user, reason);
    revalidatePath("/orders");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Action failed." };
  }
}

// ── Request cancellation (external) ───────────────────────────

export async function requestCancellationAction(orderId: string, reason: string): Promise<Result> {
  try {
    const [user, preview] = await Promise.all([requireUser(), getPreviewContext()]);
    assertNotPreview(preview);
    await requestCancellation(orderId, user, reason);
    revalidatePath("/orders");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Action failed." };
  }
}

// ── Decline cancellation ───────────────────────────────────────

export async function declineCancellationAction(orderId: string, reason?: string): Promise<Result> {
  try {
    const [user, preview] = await Promise.all([requireUser(), getPreviewContext()]);
    assertNotPreview(preview);
    await declineCancellation(orderId, user, reason);
    revalidatePath("/orders");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Action failed." };
  }
}

// ── Submit draft ──────────────────────────────────────────────

export async function submitDraftAction(orderId: string): Promise<Result> {
  try {
    const [user, preview] = await Promise.all([requireUser(), getPreviewContext()]);
    assertNotPreview(preview);
    await submitDraft(orderId, user);
    revalidatePath("/orders");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Action failed." };
  }
}

// ── Delete draft ───────────────────────────────────────────────

export async function deleteDraftAction(orderId: string): Promise<Result> {
  try {
    const [user, preview] = await Promise.all([requireUser(), getPreviewContext()]);
    assertNotPreview(preview);
    await deleteDraft(orderId, user);
    revalidatePath("/orders");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Action failed." };
  }
}

// ── Add comment ────────────────────────────────────────────────

export async function addCommentAction(_prev: unknown, formData: FormData): Promise<Result> {
  try {
    const [user, preview] = await Promise.all([requireUser(), getPreviewContext()]);
    assertNotPreview(preview);
    const orderId    = formData.get("orderId") as string;
    const body       = formData.get("body") as string;
    const isInternal = formData.getAll("isInternal").includes("true");
    await addComment(orderId, user, body, isInternal);
    revalidatePath("/orders");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to post comment." };
  }
}
