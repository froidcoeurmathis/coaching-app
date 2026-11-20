"use client";

import { startTransition, useActionState } from "react";
import { signInAction, type AuthFormState } from "@/app/actions/auth";
import { Alert, Button, Field, Input } from "./ui";

export function LoginForm() {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(signInAction, {});
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        startTransition(() => action(formData));
      }}
    >
      <Field label="Adresse e-mail" htmlFor="email">
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          autoCapitalize="none"
          defaultValue={state.email}
          required
          autoFocus
        />
      </Field>
      <Field label="Mot de passe" htmlFor="password">
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </Field>
      {state.error && <Alert>{state.error}</Alert>}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Connexion…" : "Se connecter"}
      </Button>
      <p className="text-center text-xs text-zinc-500">Mot de passe oublié ? Demandez à votre coach de le réinitialiser.</p>
    </form>
  );
}
