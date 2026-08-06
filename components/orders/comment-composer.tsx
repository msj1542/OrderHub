"use client";

import * as React from "react";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { addCommentAction } from "@/app/(app)/orders/actions";

type Props = {
  orderId:    string;
  canInternal: boolean;
};

const initialState = { error: null as string | null };

export function CommentComposer({ orderId, canInternal }: Props) {
  const [body, setBody]         = React.useState("");
  const [isInternal, setInternal] = React.useState(false);
  const [pending, setPending]   = React.useState(false);
  const [error, setError]       = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setPending(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.set("orderId",    orderId);
      fd.set("body",       body);
      fd.set("isInternal", isInternal ? "true" : "false");
      const result = await addCommentAction(undefined, fd);
      if (result?.error) { setError(result.error); } else { setBody(""); }
    } catch {
      setError("Failed to post comment.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-[var(--space-3)]">
      <Textarea
        placeholder="Add a comment…"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
        disabled={pending}
      />
      {error && (
        <p className="text-[var(--text-xs)] text-[var(--status-danger-text)]">{error}</p>
      )}
      <div className="flex items-center justify-between">
        {canInternal && (
          <label className="flex items-center gap-[var(--space-2)] cursor-pointer select-none">
            <Checkbox
              checked={isInternal}
              onCheckedChange={(v) => setInternal(!!v)}
              disabled={pending}
            />
            <span className="text-[var(--text-sm)] text-[var(--color-text-muted)]">
              Internal note (hidden from customer)
            </span>
          </label>
        )}
        <Button type="submit" size="sm" disabled={pending || !body.trim()} className="ml-auto">
          {pending ? "Posting…" : "Post"}
        </Button>
      </div>
    </form>
  );
}
