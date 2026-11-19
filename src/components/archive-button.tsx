"use client";

import { useTransition } from "react";
import { setArchivedAction } from "@/app/actions/athletes";
import { Button } from "./ui";

export function ArchiveButton({ athleteId, archived }: { athleteId: string; archived: boolean }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant={archived ? "secondary" : "danger"}
      size="sm"
      disabled={pending}
      onClick={() => {
        if (!archived && !confirm("Archiver ce coaché ? Il n'apparaîtra plus dans le calendrier (ses séances sont conservées).")) return;
        startTransition(() => setArchivedAction(athleteId, !archived));
      }}
    >
      {archived ? "Réactiver" : "Archiver"}
    </Button>
  );
}
