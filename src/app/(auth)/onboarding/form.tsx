"use client";

import { useActionState } from "react";
import { Button, Card, ErrorNote, Field, Input } from "@/components/ui";
import { createOrganization, type FormState } from "../actions";

export function OnboardingForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(createOrganization, {});
  return (
    <Card className="w-full max-w-sm">
      <h1 className="mb-1 text-xl font-semibold">Name your organization</h1>
      <p className="mb-5 text-sm text-slate-500">Your properties and contracts are kept private to this organization.</p>
      <form action={action} className="space-y-4">
        <Field label="Organization name">
          <Input name="name" placeholder="e.g. Roadway Properties LLC" required />
        </Field>
        <ErrorNote message={state.error} />
        <Button type="submit" className="w-full" disabled={pending}>Continue</Button>
      </form>
    </Card>
  );
}
