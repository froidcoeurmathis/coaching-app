"use client";

import { startTransition, useActionState, useRef } from "react";
import { changePasswordAction, type AuthFormState } from "@/app/actions/auth";
import { Alert, Button, Field, Input } from "./ui";

export function ChangePasswordForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState<AuthFormState, FormData>(async (prev, fd) => {
    const res = await changePasswordAction(prev, fd);
    if (res.ok) formRef.current?.reset();
    return res;
  }, {});
  return (
    <form
      ref={formRef}
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        startTransition(() => action(formData));
      }}
    >
      <Field label="Nouveau mot de passe" htmlFor="password" hint="8 caractères minimum">
        <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
      </Field>
      <Field label="Confirmer" htmlFor="confirm">
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={8} required />
      </Field>
      {state.error && <Alert>{state.error}</Alert>}
      {state.ok && <Alert tone="success">Mot de passe modifié.</Alert>}
      <Button type="submit" disabled={pending}>
        {pending ? "Enregistrement…" : "Changer le mot de passe"}
      </Button>
    </form>
  );
}
