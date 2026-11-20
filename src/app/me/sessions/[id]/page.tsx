import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { FeedbackForm } from "@/components/athlete/feedback-form";
import { SessionBlocks } from "@/components/athlete/session-blocks";
import { cn } from "@/components/ui";
import { requireAthlete } from "@/lib/auth/session";
import { getOwnSession } from "@/lib/db/sessions";
import { getAthleteRefs } from "@/lib/db/athletes";
import { DISCIPLINE_LABEL, DISCIPLINE_STYLE, formatDayTitle, todayISO, weekStartOf } from "@/lib/format";
import { parseISO } from "date-fns";

export const metadata: Metadata = { title: "Séance" };

async function SessionPage({ params }: { params: PageProps<"/me/sessions/[id]">["params"] }) {
  await requireAthlete();
  const { id } = await params;
  const s = await getOwnSession(id); // RLS : uniquement ses propres séances
  if (!s) notFound();
  const refs = (await getAthleteRefs([s.athlete_id]))[s.athlete_id];

  const week = weekStartOf(parseISO(s.scheduled_on));
  const isFuture = s.scheduled_on > todayISO();

  return (
    <div className="mx-auto max-w-xl space-y-4 pb-8">
      <Link href={`/me?week=${week}&day=${s.scheduled_on}`} className="text-sm text-zinc-500">
        ← Ma semaine
      </Link>

      <header className={cn("rounded-lg border-l-4 p-4", DISCIPLINE_STYLE[s.discipline])}>
        <p className="text-xs font-medium text-zinc-500">{formatDayTitle(s.scheduled_on)}</p>
        <h1 className="text-xl font-semibold">{s.title}</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {DISCIPLINE_LABEL[s.discipline]}
          {s.duration_min && ` · ${s.duration_min} min`}
        </p>
        {s.description && <p className="mt-2 whitespace-pre-line text-sm">{s.description}</p>}
      </header>

      {s.blocks.length > 0 ? (
        <>
          <p className="text-xs text-zinc-500">Touchez un exercice pour le cocher pendant la séance.</p>
          <SessionBlocks sessionId={s.id} blocks={s.blocks} checkable refs={refs} />
        </>
      ) : (
        !s.description && <p className="text-sm text-zinc-500">Pas de détail pour cette séance.</p>
      )}

      {isFuture && s.status === "planned" ? (
        <p className="rounded-lg bg-zinc-100 p-4 text-sm text-zinc-600 dark:bg-zinc-800/60 dark:text-zinc-400">
          Séance à venir : vous pourrez la valider le jour J.
        </p>
      ) : (
        <FeedbackForm
          key={`${s.status}-${s.feedback_at ?? ""}`}
          sessionId={s.id}
          status={s.status}
          rpe={s.rpe}
          comment={s.athlete_comment}
          completedAt={s.completed_at}
        />
      )}
    </div>
  );
}

export default function Page(props: PageProps<"/me/sessions/[id]">) {
  return (
    <Suspense fallback={<p className="text-sm text-zinc-500">Chargement…</p>}>
      <SessionPage params={props.params} />
    </Suspense>
  );
}
