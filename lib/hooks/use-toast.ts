import { useState, useEffect } from "react";

export type ToastVariant = "default" | "success" | "danger";

export type ToastMessage = {
  id:           string;
  title:        string;
  description?: string;
  variant?:     ToastVariant;
  duration?:    number;
};

// Module-level store so `toast()` can be called from anywhere (Server Actions,
// event handlers, etc.) without needing a React context.
type Listener = (toasts: ToastMessage[]) => void;
let _toasts: ToastMessage[] = [];
const _listeners = new Set<Listener>();

function emit(next: ToastMessage[]) {
  _toasts = next;
  _listeners.forEach((fn) => fn(next));
}

export function dismiss(id: string) {
  emit(_toasts.filter((t) => t.id !== id));
}

export function toast(opts: Omit<ToastMessage, "id">) {
  const id  = Math.random().toString(36).slice(2, 9);
  const msg: ToastMessage = { duration: 4000, variant: "default", ...opts, id };
  emit([..._toasts, msg]);
  setTimeout(() => dismiss(id), msg.duration ?? 4000);
  return id;
}

export function useToast() {
  const [toasts, setToasts] = useState<ToastMessage[]>(_toasts);

  useEffect(() => {
    _listeners.add(setToasts);
    return () => { _listeners.delete(setToasts); };
  }, []);

  return { toasts, dismiss };
}
