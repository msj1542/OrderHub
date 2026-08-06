"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { saveOrSubmitOrder } from "@/lib/orders/service";
import type { OrderLineInput } from "@/lib/orders/service";

type ActionResult =
  | { orderId: string; orderNumber: string | null; status: string; error?: never; duplicateOrderId?: never }
  | { error: string; orderId?: never; duplicateOrderId?: never }
  | { duplicateOrderId: string; duplicateOrderNumber: string | null; error?: never; orderId?: never };

async function handleOrderAction(
  _prev: unknown,
  formData: FormData,
  mode: "draft" | "submit",
): Promise<ActionResult> {
  try {
    const user = await requireUser();

    const companyId             = formData.get("companyId") as string;
    const poNumber              = (formData.get("poNumber") as string) || "";
    const isExpedited           = formData.get("isExpedited") === "true";
    const requestedDate         = (formData.get("requestedDate") as string) || undefined;
    const customerNotes         = (formData.get("customerNotes") as string) || "";
    const internalNotes         = (formData.get("internalNotes") as string) || "";
    const supplementalToOrderId = (formData.get("supplementalToOrderId") as string) || undefined;
    const linesJson             = formData.get("lines") as string;
    const lines                 = JSON.parse(linesJson) as OrderLineInput[];

    const targetCompanyId = user.role.isInternal ? companyId : user.companyId!;

    const result = await saveOrSubmitOrder(
      user,
      {
        companyId:             targetCompanyId,
        poNumber,
        isExpedited,
        requestedDate,
        customerNotes,
        internalNotes,
        supplementalToOrderId,
        lines,
      },
      mode,
    );

    revalidatePath("/orders");
    return result;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "An unexpected error occurred.";
    // Bubble duplicate-PO as structured response
    if (
      err instanceof Error &&
      "code" in err &&
      (err as Error & { code?: string; existingOrderId?: string }).code === "duplicate_order"
    ) {
      const e = err as Error & { existingOrderId?: string };
      return {
        duplicateOrderId:     e.existingOrderId ?? "",
        duplicateOrderNumber: null,
      };
    }
    return { error: msg };
  }
}

export async function saveOrderAction(
  prev: unknown,
  formData: FormData,
): Promise<ActionResult> {
  return handleOrderAction(prev, formData, "draft");
}

export async function submitOrderAction(
  prev: unknown,
  formData: FormData,
): Promise<ActionResult> {
  return handleOrderAction(prev, formData, "submit");
}
