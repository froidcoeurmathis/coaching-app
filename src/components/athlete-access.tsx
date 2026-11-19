"use client";

import { useState, useTransition } from "react";
import { inviteAthleteAction, type FormState } from "@/app/actions/athletes";
import { Alert, Button } from "./ui";

export function AthleteAccess({
  athleteId,
  email,
  linked,
  invitedAt,
  archived,
}: {
  athleteId: string;
  email: string | null;
  linked: boolean;
  invitedAt: string | null;
  archived: boolean;
}) {
  const [state, setState] = useState<FormState>({});
  const [pending, startTransition] = useTransition();

  const invite = () =>
    startTransition(async () => {
      setState(await inviteAthleteAction(athleteId));
    });

  return (
    <div className="space-y-3 text-sm">
      {linked ? (
        <p>
          <span className="mr-2 inline-block size-2 rounded-full bg-emerald-500" aria-hidden />
          Compte activé{email && <> — se connecte avec <strong>{email}</strong></>}.
          {archived && " Coaché archivé : il voit toujours ses anciennes séances."}
        </p>
      ) : !email ? (
        <p className="text-zinc-600 dark:text-zinc-400">
          Renseignez l&apos;e-mail du coaché dans son profil pour pouvoir l&apos;inviter.
        </p>
      ) : (
        <>
          <p className="text-zinc-600 dark:text-zinc-400">
            {invitedAt
              ? `Invitation envoyée le ${new Date(invitedAt).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Paris" })}, en attente de première connexion.`
              : "Pas encore invité."}{" "}
            Il recevra un lien de connexion à <strong className="text-zinc-900 dark:text-zinc-100">{email}</strong> et
            ne verra que ses propres séances.
          </p>
          <Button size="sm" onClick={invite} disabled={pending || archived}>
            {pending ? "Envoi…" : invitedAt ? "Renvoyer l'invitation" : "Envoyer l'invitation"}
          </Button>
        </>
      )}
      {state.error && <Alert>{state.error}</Alert>}
      {state.ok && <Alert tone="success">Invitation envoyée.</Alert>}
    </div>
  );
}
