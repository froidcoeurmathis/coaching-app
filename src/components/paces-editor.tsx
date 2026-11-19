"use client";

import { useState, useTransition } from "react";
import { savePacesAction } from "@/app/actions/athletes";
import { paceToSpeed, parsePace } from "@/lib/format";
import { Alert, Button, Input } from "./ui";

type Row = { key: number; label: string; pace: string };

let nextKey = 0;
const PRESETS = ["Endurance fondamentale", "Marathon", "Semi", "10 km", "Seuil", "VMA"];

export function PacesEditor({
  athleteId,
  initial,
}: {
  athleteId: string;
  initial: { label: string; pace: string; speed: string }[];
}) {
  const [rows, setRows] = useState<Row[]>(() =>
    initial.map((p) => ({ key: nextKey++, label: p.label, pace: p.pace })),
  );
  const [status, setStatus] = useState<{ ok?: boolean; error?: string }>({});
  const [pending, startTransition] = useTransition();

  const update = (key: number, patch: Partial<Row>) => {
    setStatus({});
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  };

  return (
    <div className="space-y-3">
      {rows.length === 0 && <p className="text-sm text-zinc-500">Aucune allure renseignée.</p>}
      {rows.map((r) => {
        const s = parsePace(r.pace);
        return (
          <div key={r.key} className="flex items-center gap-2">
            <Input
              aria-label="Nom de l'allure"
              value={r.label}
              onChange={(e) => update(r.key, { label: e.target.value })}
              placeholder="ex. Seuil"
              list="pace-presets"
              className="flex-1"
            />
            <Input
              aria-label="Allure (min/km)"
              value={r.pace}
              onChange={(e) => update(r.key, { pace: e.target.value })}
              placeholder="4:50"
              className="w-20! text-center"
              inputMode="numeric"
            />
            <span className="w-16 text-right text-xs tabular-nums text-zinc-500">
              {s ? `${paceToSpeed(s)} km/h` : ""}
            </span>
            <Button
              variant="ghost"
              size="sm"
              aria-label="Supprimer"
              onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}
            >
              ✕
            </Button>
          </div>
        );
      })}
      <datalist id="pace-presets">
        {PRESETS.map((p) => (
          <option key={p} value={p} />
        ))}
      </datalist>

      {status.error && <Alert>{status.error}</Alert>}
      {status.ok && <Alert tone="success">Allures enregistrées.</Alert>}

      <div className="flex justify-between gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setRows((rs) => [...rs, { key: nextKey++, label: "", pace: "" }])}
        >
          + Allure
        </Button>
        <Button
          size="sm"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              setStatus(await savePacesAction(athleteId, rows));
            })
          }
        >
          {pending ? "Enregistrement…" : "Enregistrer les allures"}
        </Button>
      </div>
    </div>
  );
}
