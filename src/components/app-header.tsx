import Link from "next/link";
import { Suspense } from "react";
import { signOutAction } from "@/app/actions/auth";
import { getCurrentProfile, homeFor } from "@/lib/auth/session";
import { NavLinks, NavLinksView } from "./nav-links";
import { Button } from "./ui";

function Shell({ home = "/", children }: { home?: string; children?: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90">
      <div className="mx-auto flex h-14 max-w-[1400px] items-center justify-between gap-4 px-4">
        <Link href={home} className="text-sm font-semibold tracking-tight">
          Coaching
        </Link>
        <div className="flex items-center gap-2">{children}</div>
      </div>
    </header>
  );
}

export function HeaderFallback() {
  return <Shell />;
}

export async function AppHeader() {
  const profile = await getCurrentProfile();
  if (!profile) return <Shell />;

  return (
    <Shell home={homeFor(profile.role)}>
      {profile.role === "coach" && (
        <Suspense fallback={<NavLinksView pathname={null} />}>
          <NavLinks />
        </Suspense>
      )}
      <Link
        href="/account"
        className="rounded-md px-2 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
        title="Mon compte"
      >
        <span className="hidden sm:inline">{profile.full_name}</span>
        <span className="sm:hidden" aria-label="Mon compte">Compte</span>
      </Link>
      <form action={signOutAction}>
        <Button type="submit" variant="ghost" size="sm">
          Déconnexion
        </Button>
      </form>
    </Shell>
  );
}
