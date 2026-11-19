"use client";

import { startTransition, useActionState } from "react";
import { sendLoginLinkAction, verifyLoginCodeAction, type LoginState } from "@/app/actions/auth";
import { Alert, Button, Field, Input } from "./ui";

function submit(action: (fd: FormData) => void) {
  return (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(() => action(formData));
  };
}

export function LoginForm({ initialError }: { initialError?: string }) {
  const [sendState, send, sending] = useActionState<LoginState, FormData>(sendLoginLinkAction, {
    step: "email",
    error: initialError,
  });
  const [codeState, verify, verifying] = useActionState<LoginState, FormData>(verifyLoginCodeAction, {
    step: "code",
  });

  // Un échec définitif à l'étape code (aucun profil) renvoie à l'étape e-mail.
  const backToEmail = codeState.step === "email" && !!codeState.error;
  const step = backToEmail ? "email" : sendState.step;
  const error = backToEmail ? codeState.error : step === "code" ? codeState.error : sendState.error;

  if (step === "code" && sendState.email) {
    return (
      <div className="space-y-4">
        {sendState.info && <Alert tone="success">{sendState.info}</Alert>}
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Cliquez sur le lien reçu à <strong className="text-zinc-900 dark:text-zinc-100">{sendState.email}</strong>, ou
          saisissez le code à 6 chiffres :
        </p>
        <form onSubmit={submit(verify)} className="space-y-3">
          <input type="hidden" name="email" value={sendState.email} />
          <Field label="Code" htmlFor="code">
            <Input
              id="code"
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={7}
              placeholder="123456"
              className="text-center text-lg tracking-[0.4em]"
              autoFocus
              required
            />
          </Field>
          {error && <Alert>{error}</Alert>}
          <Button type="submit" disabled={verifying} className="w-full">
            {verifying ? "Vérification…" : "Se connecter"}
          </Button>
        </form>
        <form onSubmit={submit(send)}>
          <input type="hidden" name="email" value={sendState.email} />
          <Button type="submit" variant="ghost" size="sm" disabled={sending} className="w-full">
            {sending ? "Envoi…" : "Renvoyer un e-mail"}
          </Button>
        </form>
      </div>
    );
  }

  return (
    <form onSubmit={submit(send)} className="space-y-4">
      <Field label="Adresse e-mail" htmlFor="email">
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          defaultValue={sendState.email}
          required
          autoFocus
        />
      </Field>
      {error && <Alert>{error}</Alert>}
      <Button type="submit" disabled={sending} className="w-full">
        {sending ? "Envoi…" : "Recevoir mon lien de connexion"}
      </Button>
    </form>
  );
}
