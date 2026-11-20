"use client";

import { useEffect, useState } from "react";
import { Button } from "../ui";

type BeforeInstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

const DISMISS_KEY = "coaching:install-hint-dismissed";

/**
 * Invite à installer l'appli sur l'écran d'accueil :
 * - Android / Chrome : bouton qui déclenche l'invite d'installation native ;
 * - iPhone / Safari : instructions (Partager → « Sur l'écran d'accueil »).
 * Masqué si l'appli est déjà installée ou si l'utilisateur l'a fermé.
 */
export function InstallHint() {
  const [mode, setMode] = useState<"hidden" | "prompt" | "ios">("hidden");
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(DISMISS_KEY) === "1";
    } catch {}
    if (standalone || dismissed) return;

    const ua = navigator.userAgent;
    const isIOS = /iPhone|iPad|iPod/.test(ua) || (ua.includes("Mac") && navigator.maxTouchPoints > 1);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- détection au montage
    if (isIOS) setMode("ios");

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setMode("prompt");
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {}
    setMode("hidden");
  };

  if (mode === "hidden") return null;

  return (
    <div className="mb-4 flex items-start gap-3 rounded-lg border border-zinc-200 bg-white p-3 text-sm dark:border-zinc-800 dark:bg-zinc-900">
      <span aria-hidden className="text-xl">📲</span>
      <div className="flex-1">
        <p className="font-medium">Ajoutez l&apos;appli à votre écran d&apos;accueil</p>
        {mode === "ios" ? (
          <p className="mt-0.5 text-zinc-600 dark:text-zinc-400">
            Dans Safari, touchez <strong>Partager</strong> puis <strong>« Sur l&apos;écran d&apos;accueil »</strong>. À la
            première ouverture, reconnectez-vous avec votre e-mail et votre mot de passe.
          </p>
        ) : (
          <Button
            size="sm"
            className="mt-2"
            onClick={async () => {
              if (!deferred) return;
              await deferred.prompt();
              await deferred.userChoice;
              setDeferred(null);
              setMode("hidden");
            }}
          >
            Installer
          </Button>
        )}
      </div>
      <button type="button" onClick={dismiss} className="text-zinc-400 hover:text-zinc-700" aria-label="Fermer">
        ✕
      </button>
    </div>
  );
}
