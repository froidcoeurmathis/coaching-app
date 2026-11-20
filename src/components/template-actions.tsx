"use client";

import { useState, useTransition } from "react";
import { deleteTemplateAction, renameTemplateAction } from "@/app/actions/templates";
import { Button } from "./ui";

export function TemplateActions({ id, name }: { id: string; name: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="mt-3">
      <div className="flex gap-1">
        <Button
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={() => {
            const next = prompt("Nouveau nom du modèle :", name);
            if (!next?.trim() || next.trim() === name) return;
            startTransition(async () => {
              const res = await renameTemplateAction(id, next);
              setError(res.ok ? null : res.error);
            });
          }}
        >
          Renommer
        </Button>
        <Button
          variant="danger"
          size="sm"
          disabled={pending}
          onClick={() => {
            if (!confirm(`Supprimer le modèle « ${name} » ? Les séances déjà créées ne sont pas modifiées.`)) return;
            startTransition(async () => {
              const res = await deleteTemplateAction(id);
              setError(res.ok ? null : res.error);
            });
          }}
        >
          Supprimer
        </Button>
      </div>
      {error && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
