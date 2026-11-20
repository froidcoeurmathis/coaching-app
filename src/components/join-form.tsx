"use client";

import { startTransition, useActionState } from "react";
import { joinAction, type AuthFormState } from "@/app/actions/auth";
import { Alert, Button, Field, Input } from "./ui";

export function JoinForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(joinAction, {});
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        startTransition(() => action(formData));
      }}
    >
      <input type="hidden" name="token" value={token} />
      <Field label="Adresse e-mail" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="email" inputMode="email" autoCapitalize="none" defaultValue={state.email} required autoFocus />
      </Field>
      <Field label="Mot de passe" htmlFor="password" hint="8 caractères minimum">
        <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
      </Field>
      <Field label="Confirmer le mot de passe" htmlFor="confirm">
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={8} required />
      </Field>
      {state.error && <Alert>{state.error}</Alert>}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Création…" : "Créer mon compte"}
      </Button>
    </form>
  );
}
