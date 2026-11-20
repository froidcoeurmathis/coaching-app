"use client";

import { useState, useTransition } from "react";
import { createInviteLinkAction, setAthletePasswordAction, type FormState } from "@/app/actions/athletes";
import { Alert, Button, Input } from "./ui";

/** Mot de passe lisible à dicter / envoyer : 10 caractères sans lettres ambiguës. */
function generatePassword(): string {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const values = crypto.getRandomValues(new Uint32Array(10));
  return Array.from(values, (v) => chars[v % chars.length]).join("");
}

function CopyButton({ text, label = "Copier" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      size="sm"
      variant="secondary"
      onClick={() =>
        navigator.clipboard
          ?.writeText(text)
          .then(() => (setCopied(true), setTimeout(() => setCopied(false), 2000)))
          .catch(() => {})
      }
    >
      {copied ? "Copié ✓" : label}
    </Button>
  );
}

export function AthleteAccess({
  athleteId,
  firstName,
  email,
  linked,
  archived,
  inviteCreatedAt,
}: {
  athleteId: string;
  firstName: string;
  email: string | null;
  linked: boolean;
  archived: boolean;
  inviteCreatedAt: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [shared, setShared] = useState<{ email: string; password: string } | null>(null);

  const createLink = () =>
    startTransition(async () => {
      setError(null);
      const res = await createInviteLinkAction(athleteId);
      if (res.ok) setInviteUrl(res.url);
      else setError(res.error);
    });

  const savePassword = () =>
    startTransition(async () => {
      const res: FormState = await setAthletePasswordAction(athleteId, password);
      if (res.error) return setError(res.error);
      setError(null);
      if (email) setShared({ email, password });
      setPassword("");
      setManualOpen(false);
    });

  const message = inviteUrl
    ? `Bonjour ${firstName} ! Voici le lien pour créer ton compte et retrouver tes séances : ${inviteUrl}`
    : "";
  const credentials = shared ? `Adresse : ${shared.email}\nMot de passe : ${shared.password}` : "";

  if (archived && !linked) return <p className="text-sm text-zinc-500">Coaché archivé.</p>;

  return (
    <div className="space-y-3 text-sm">
      {linked ? (
        <p>
          <span className="mr-2 inline-block size-2 rounded-full bg-emerald-500" aria-hidden />
          Compte actif{email && <> — se connecte avec <strong>{email}</strong></>}.
          {archived && " Coaché archivé : il voit toujours ses anciennes séances."}
        </p>
      ) : (
        <>
          <p className="text-zinc-600 dark:text-zinc-400">
            {firstName} n&apos;a pas encore de compte. Envoyez-lui un lien d&apos;invitation : il y choisira lui-même son
            e-mail et son mot de passe, puis verra uniquement ses séances.
            {inviteCreatedAt && !inviteUrl && (
              <>
                {" "}
                Un lien a déjà été créé le{" "}
                {new Date(inviteCreatedAt).toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" })} (en créer un nouveau
                désactive l&apos;ancien).
              </>
            )}
          </p>
          {!inviteUrl ? (
            <Button size="sm" onClick={createLink} disabled={pending}>
              {pending ? "Création…" : inviteCreatedAt ? "Créer un nouveau lien d'invitation" : "Créer un lien d'invitation"}
            </Button>
          ) : (
            <div className="space-y-2 rounded-md bg-emerald-50 p-3 dark:bg-emerald-950/40" role="status">
              <p className="font-medium">Lien d&apos;invitation à envoyer à {firstName} (SMS, WhatsApp, e-mail…) :</p>
              <Input readOnly value={inviteUrl} onFocus={(e) => e.currentTarget.select()} aria-label="Lien d'invitation" className="font-mono text-xs" />
              <div className="flex flex-wrap gap-2">
                <CopyButton text={inviteUrl} label="Copier le lien" />
                <CopyButton text={message} label="Copier avec un message" />
                {typeof navigator !== "undefined" && "share" in navigator && (
                  <Button size="sm" variant="secondary" onClick={() => navigator.share({ text: message }).catch(() => {})}>
                    Partager…
                  </Button>
                )}
              </div>
              <p className="text-xs text-zinc-500">Le lien ne sert qu&apos;une fois : il est désactivé dès que le compte est créé.</p>
            </div>
          )}
        </>
      )}

      {shared && (
        <div className="space-y-2 rounded-md bg-emerald-50 p-3 dark:bg-emerald-950/40" role="status">
          <p className="font-medium">Identifiants à transmettre (affichés une seule fois) :</p>
          <pre className="whitespace-pre-wrap rounded bg-white/70 p-2 font-mono text-xs dark:bg-black/30">{credentials}</pre>
          <CopyButton text={credentials} />
        </div>
      )}

      {/* Option secondaire : le coach fixe lui-même le mot de passe */}
      {(linked || email) && !archived && (
        <div>
          {!manualOpen ? (
            <button
              type="button"
              className="text-xs text-zinc-500 underline hover:text-zinc-800 dark:hover:text-zinc-200"
              onClick={() => (setManualOpen(true), setShared(null), setError(null))}
            >
              {linked ? "Réinitialiser son mot de passe" : "Ou définir moi-même son mot de passe (avec l'e-mail de la fiche)"}
            </button>
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
                <Button size="sm" onClick={savePassword} disabled={pending || password.length < 8}>
                  {pending ? "Enregistrement…" : "Enregistrer le mot de passe"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setManualOpen(false)}>
                  Annuler
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
      {error && <Alert>{error}</Alert>}
    </div>
  );
}
