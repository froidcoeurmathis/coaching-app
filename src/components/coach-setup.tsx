"use client";

import { useActionState } from "react";
import { createCoachAction, type FormState } from "@/app/actions/athletes";
import { Alert, Button, Card, Field, Input } from "./ui";

export function CoachSetup() {
  const [state, action, pending] = useActionState<FormState, FormData>(createCoachAction, {});
  return (
    <div className="mx-auto mt-12 max-w-md">
      <Card>
        <h1 className="text-lg font-semibold">Bienvenue 👋</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Créez votre profil coach pour commencer à gérer vos coachés.
        </p>
        <form action={action} className="mt-5 space-y-4">
          {state.error && <Alert>{state.error}</Alert>}
          <Field label="Nom" htmlFor="full_name" error={state.fieldErrors?.full_name}>
            <Input id="full_name" name="full_name" required autoComplete="name" />
          </Field>
          <Field label="E-mail" htmlFor="email" error={state.fieldErrors?.email}>
            <Input id="email" name="email" type="email" autoComplete="email" />
          </Field>
          <Button type="submit" disabled={pending} className="w-full">
            {pending ? "Création…" : "Créer mon profil"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
