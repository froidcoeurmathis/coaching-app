"use client";

import { startTransition, useActionState } from "react";
import { saveAthleteAction, type FormState } from "@/app/actions/athletes";
import type { Athlete } from "@/lib/db/types";
import { Alert, Button, Field, Input, Textarea } from "./ui";

export function AthleteForm({ athlete }: { athlete?: Athlete }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveAthleteAction, {});
  const err = state.fieldErrors ?? {};
  const v = (k: keyof Athlete) => (athlete?.[k] ?? "") as string | number;

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        // Soumission manuelle : évite la réinitialisation automatique du formulaire
        // par React (les valeurs saisies restent affichées en cas d'erreur).
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        startTransition(() => action(formData));
      }}
    >
      {athlete && <input type="hidden" name="id" value={athlete.id} />}
      {state.error && <Alert>{state.error}</Alert>}
      {state.ok && <Alert tone="success">Fiche enregistrée.</Alert>}

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Prénom *" htmlFor="first_name" error={err.first_name}>
          <Input id="first_name" name="first_name" defaultValue={v("first_name")} required />
        </Field>
        <Field label="Nom" htmlFor="last_name" error={err.last_name}>
          <Input id="last_name" name="last_name" defaultValue={v("last_name")} />
        </Field>
        <Field label="E-mail" htmlFor="email" error={err.email} hint="Adresse de connexion du coaché">
          <Input id="email" name="email" type="email" defaultValue={v("email")} />
        </Field>
      </div>

      <Field label="Objectif" htmlFor="goal" error={err.goal}>
        <Textarea id="goal" name="goal" rows={2} defaultValue={v("goal")} placeholder="ex. Finir un Hyrox en moins de 1h30" />
      </Field>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Échéance / compétition" htmlFor="target_event" error={err.target_event} className="sm:col-span-2">
          <Input id="target_event" name="target_event" defaultValue={v("target_event")} placeholder="ex. Hyrox Paris — Open" />
        </Field>
        <Field label="Date" htmlFor="target_date" error={err.target_date}>
          <Input id="target_date" name="target_date" type="date" defaultValue={v("target_date")} />
        </Field>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Field label="VMA (km/h)" htmlFor="vma_kmh" error={err.vma_kmh}>
          <Input id="vma_kmh" name="vma_kmh" inputMode="decimal" defaultValue={v("vma_kmh")} placeholder="15,5" />
        </Field>
        <Field label="FC max" htmlFor="hr_max" error={err.hr_max}>
          <Input id="hr_max" name="hr_max" inputMode="numeric" defaultValue={v("hr_max")} placeholder="190" />
        </Field>
        <Field label="FC repos" htmlFor="hr_rest" error={err.hr_rest}>
          <Input id="hr_rest" name="hr_rest" inputMode="numeric" defaultValue={v("hr_rest")} placeholder="55" />
        </Field>
      </div>

      <Field label="Notes (blessures, contraintes, matériel…)" htmlFor="notes" error={err.notes}>
        <Textarea id="notes" name="notes" defaultValue={v("notes")} />
      </Field>

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Enregistrement…" : athlete ? "Enregistrer" : "Créer le coaché"}
        </Button>
      </div>
    </form>
  );
}
