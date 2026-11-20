"use client";

import { useState, useTransition } from "react";
import { setAthletePasswordAction, type FormState } from "@/app/actions/athletes";
import { Alert, Button, Input } from "./ui";

/** Mot de passe lisible à dicter / envoyer : 10 caractères sans lettres ambiguës. */
function generatePassword(): string {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const values = crypto.getRandomValues(new Uint32Array(10));
  return Array.from(values, (v) => chars[v % chars.length]).join("");
}

export function AthleteAccess({
  athleteId,
  email,
  linked,
  archived,
}: {
  athleteId: string;
  email: string | null;
  linked: boolean;
  archived: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [state, setState] = useState<FormState>({});
  const [shared, setShared] = useState<{ email: string; password: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = () =>
    startTransition(async () => {
      const res = await setAthletePasswordAction(athleteId, password);
      setState(res);
      if (res.ok && email) {
        setShared({ email, password });
        setPassword("");
        setOpen(false);
      }
    });

  const credentials = shared ? `Adresse : ${shared.email}\nMot de passe : ${shared.password}` : "";

  return (
    <div className="space-y-3 text-sm">
      {linked ? (
        <p>
          <span className="mr-2 inline-block size-2 rounded-full bg-emerald-500" aria-hidden />
          Accès actif{email && <> — se connecte avec <strong>{email}</strong></>}.
          {archived && " Coaché archivé : il voit toujours ses anciennes séances."}
        </p>
      ) : !email ? (
        <p className="text-zinc-600 dark:text-zinc-400">
          Renseignez l&apos;e-mail du coaché dans son profil pour lui créer un accès.
        </p>
      ) : (
        <p className="text-zinc-600 dark:text-zinc-400">
          Pas encore d&apos;accès. Créez-le avec son e-mail <strong className="text-zinc-900 dark:text-zinc-100">{email}</strong>{" "}
          et un mot de passe que vous lui transmettrez. Il ne verra que ses propres séances.
        </p>
      )}

      {shared && (
        <div className="space-y-2 rounded-md bg-emerald-50 p-3 dark:bg-emerald-950/40" role="status">
          <p className="font-medium">Identifiants à transmettre (affichés une seule fois) :</p>
          <pre className="whitespace-pre-wrap rounded bg-white/70 p-2 font-mono text-xs dark:bg-black/30">{credentials}</pre>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => navigator.clipboard?.writeText(credentials).catch(() => {})}
          >
            Copier
          </Button>
        </div>
      )}

      {email && !archived && (
        <>
          {!open ? (
            <Button size="sm" variant={linked ? "secondary" : "primary"} onClick={() => (setOpen(true), setShared(null), setState({}))}>
              {linked ? "Réinitialiser le mot de passe" : "Créer l'accès"}
            </Button>
          ) : (
            <div className="space-y-2">
              <label htmlFor="athlete-password" className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                {linked ? "Nouveau mot de passe" : "Mot de passe"} (8 caractères minimum)
              </label>
              <div className="flex flex-wrap gap-2">
                <Input
                  id="athlete-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="off"
                  className="w-56! font-mono"
                />
                <Button variant="secondary" size="sm" className="h-9" onClick={() => setPassword(generatePassword())}>
                  Générer
                </Button>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={submit} disabled={pending || password.length < 8}>
                  {pending ? "Enregistrement…" : linked ? "Enregistrer le mot de passe" : "Créer l'accès"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
                  Annuler
                </Button>
              </div>
            </div>
          )}
        </>
      )}
      {state.error && <Alert>{state.error}</Alert>}
    </div>
  );
}
