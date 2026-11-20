import type { Metadata } from "next";
import { Suspense } from "react";
import { TemplateActions } from "@/components/template-actions";
import { cn } from "@/components/ui";
import { requireCoach } from "@/lib/auth/session";
import { listTemplates } from "@/lib/db/templates";
import { DISCIPLINE_LABEL, DISCIPLINE_STYLE, exerciseLabel, volumeSummary } from "@/lib/format";

export const metadata: Metadata = { title: "Modèles" };

async function Templates() {
  const coach = await requireCoach();
  const templates = await listTemplates(coach.id);

  if (templates.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-zinc-300 p-10 text-center text-sm text-zinc-500 dark:border-zinc-700">
        Aucun modèle pour l&apos;instant. Dans le calendrier, ouvrez une séance et cliquez sur
        « Enregistrer comme modèle ». Vous pourrez ensuite la réutiliser via « Partir d&apos;un modèle ».
      </div>
    );
  }

  return (
    <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {templates.map((t) => (
        <li key={t.id} className={cn("flex flex-col rounded-lg border-l-4 p-4", DISCIPLINE_STYLE[t.discipline])}>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h2 className="font-semibold">{t.name}</h2>
              <p className="text-xs text-zinc-500">
                {t.title !== t.name && `${t.title} · `}
                {DISCIPLINE_LABEL[t.discipline]}
                {t.duration_min && ` · ${t.duration_min} min`}
              </p>
            </div>
          </div>
          {t.blocks.length > 0 && (
            <ul className="mt-2 flex-1 space-y-0.5 text-xs text-zinc-600 dark:text-zinc-400">
              {t.blocks.flatMap((b, bi) =>
                b.exercises.map((e, ei) => (
                  <li key={`${bi}-${ei}`} className="truncate">
                    <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                      {exerciseLabel(bi, ei, b.exercises.length)}
                    </span>{" "}
                    {e.name}
                    {volumeSummary(e) && <span className="text-zinc-500"> · {volumeSummary(e)}</span>}
                  </li>
                )),
              )}
            </ul>
          )}
          <TemplateActions id={t.id} name={t.name} />
        </li>
      ))}
    </ul>
  );
}

export default function TemplatesPage() {
  return (
    <div>
      <h1 className="text-xl font-semibold">Modèles de séances</h1>
      <p className="mb-4 mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Enregistrez une séance comme modèle depuis l&apos;éditeur, puis appliquez-la en un clic à n&apos;importe quel
        coaché et n&apos;importe quel jour.
      </p>
      <Suspense fallback={<p className="text-sm text-zinc-500">Chargement…</p>}>
        <Templates />
      </Suspense>
    </div>
  );
}
