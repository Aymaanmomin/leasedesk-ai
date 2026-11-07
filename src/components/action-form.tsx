"use client";

import { useActionState, type ReactNode } from "react";
import { Button, ErrorNote } from "./ui";

type State = { error?: string; ok?: boolean };

export function ActionForm({
  action,
  submitLabel,
  successMessage = "Saved.",
  className = "space-y-4",
  children,
}: {
  action: (s: State, f: FormData) => Promise<State>;
  submitLabel: string;
  successMessage?: string;
  className?: string;
  children: ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className={className}>
      {children}
      <ErrorNote message={state.error} />
      {state.ok && <p className="text-sm text-green-700">{successMessage}</p>}
      <Button type="submit" disabled={pending}>{pending ? "Saving…" : submitLabel}</Button>
    </form>
  );
}
