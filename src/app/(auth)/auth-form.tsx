"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button, Card, ErrorNote, Field, Input } from "@/components/ui";
import { signIn, signUp, type FormState } from "./actions";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const [state, action, pending] = useActionState<FormState, FormData>(mode === "login" ? signIn : signUp, {});
  return (
    <Card className="w-full max-w-sm">
      <h1 className="mb-1 text-xl font-semibold">{mode === "login" ? "Sign in" : "Create your account"}</h1>
      <p className="mb-5 text-sm text-slate-500">LeaseDesk AI</p>
      <form action={action} className="space-y-4">
        <Field label="Email">
          <Input name="email" type="email" autoComplete="email" required />
        </Field>
        <Field label="Password" hint={mode === "signup" ? "At least 8 characters" : undefined}>
          <Input name="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} required minLength={8} />
        </Field>
        <ErrorNote message={state.error} />
        {state.message && <p className="rounded-md bg-teal-50 px-3 py-2 text-sm text-teal-800">{state.message}</p>}
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
        </Button>
      </form>
      <p className="mt-4 text-center text-sm text-slate-600">
        {mode === "login" ? (
          <>No account? <Link className="text-teal-700 underline" href="/signup">Sign up</Link></>
        ) : (
          <>Have an account? <Link className="text-teal-700 underline" href="/login">Sign in</Link></>
        )}
      </p>
    </Card>
  );
}
