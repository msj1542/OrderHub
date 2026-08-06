import { describe, it, expect } from "vitest";
import { getTransition, assertCanTransition, TRANSITIONS } from "./statusMachine";

describe("getTransition", () => {
  it("returns a rule when the current status is valid", () => {
    const rule = getTransition("submit", "draft");
    expect(rule).not.toBeNull();
    expect(rule?.toStatus).toBe("submitted");
  });

  it("returns null when the current status is invalid", () => {
    expect(getTransition("submit", "submitted")).toBeNull();
    expect(getTransition("submit", "canceled")).toBeNull();
    expect(getTransition("accept", "draft")).toBeNull();
  });

  it("returns null for unknown actions", () => {
    expect(getTransition("unknown" as any, "draft")).toBeNull();
  });
});

describe("assertCanTransition", () => {
  it("returns the rule on valid transition", () => {
    const rule = assertCanTransition("accept", "submitted");
    expect(rule.toStatus).toBe("accepted");
  });

  it("throws on invalid transition", () => {
    expect(() => assertCanTransition("accept", "draft")).toThrow();
    expect(() => assertCanTransition("qc", "submitted")).toThrow();
  });

  it("uses custom error message", () => {
    expect(() => assertCanTransition("accept", "draft", "Custom message")).toThrow("Custom message");
  });
});

describe("valid transition chain", () => {
  const chain: Array<[string, string, string]> = [
    ["submit",         "draft",                "submitted"],
    ["accept",         "submitted",            "accepted"],
    ["claim",          "accepted",             "in_fulfillment"],
    ["qc",             "in_fulfillment",       "fulfillment_completed"],
    ["invoice_verify", "fulfillment_completed","ready_for_pickup"],
    ["release",        "ready_for_pickup",     "released"],
    ["close",          "released",             "closed"],
  ];

  chain.forEach(([action, from, to]) => {
    it(`${action}: ${from} → ${to}`, () => {
      const rule = getTransition(action as any, from);
      expect(rule).not.toBeNull();
      expect(rule?.toStatus).toBe(to);
    });
  });
});

describe("cancellation transitions", () => {
  it("request_cancel valid from submitted and accepted", () => {
    expect(getTransition("request_cancel", "submitted")).not.toBeNull();
    expect(getTransition("request_cancel", "accepted")).not.toBeNull();
    expect(getTransition("request_cancel", "in_fulfillment")).toBeNull();
  });

  it("cancel valid from submitted and accepted", () => {
    expect(getTransition("cancel", "submitted")).not.toBeNull();
    expect(getTransition("cancel", "accepted")).not.toBeNull();
    expect(getTransition("cancel", "released")).toBeNull();
  });

  it("decline_cancel valid from submitted and accepted", () => {
    expect(getTransition("decline_cancel", "submitted")).not.toBeNull();
    expect(getTransition("decline_cancel", "accepted")).not.toBeNull();
    expect(getTransition("decline_cancel", "draft")).toBeNull();
  });

  it("cancel toStatus is 'canceled'", () => {
    expect(getTransition("cancel", "submitted")?.toStatus).toBe("canceled");
  });

  it("request_cancel toStatus is null (no status change)", () => {
    expect(getTransition("request_cancel", "submitted")?.toStatus).toBeNull();
  });

  it("decline_cancel toStatus is null (no status change)", () => {
    expect(getTransition("decline_cancel", "submitted")?.toStatus).toBeNull();
  });
});

describe("delete_draft", () => {
  it("only valid from draft", () => {
    expect(getTransition("delete_draft", "draft")).not.toBeNull();
    expect(getTransition("delete_draft", "submitted")).toBeNull();
    expect(getTransition("delete_draft", "canceled")).toBeNull();
  });
});

describe("authz actions on transitions", () => {
  it("submit requires order:submit", () => {
    expect(TRANSITIONS.submit.authzAction).toBe("order:submit");
  });
  it("accept requires order:accept", () => {
    expect(TRANSITIONS.accept.authzAction).toBe("order:accept");
  });
  it("qc requires order:qc", () => {
    expect(TRANSITIONS.qc.authzAction).toBe("order:qc");
  });
  it("invoice_verify requires order:invoice_verify", () => {
    expect(TRANSITIONS.invoice_verify.authzAction).toBe("order:invoice_verify");
  });
  it("cancel requires order:cancel", () => {
    expect(TRANSITIONS.cancel.authzAction).toBe("order:cancel");
  });
  it("decline_cancel requires order:decline_cancel", () => {
    expect(TRANSITIONS.decline_cancel.authzAction).toBe("order:decline_cancel");
  });
});
