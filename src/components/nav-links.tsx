"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "./ui";

const LINKS = [
  { href: "/calendar", label: "Calendrier" },
  { href: "/athletes", label: "Coachés" },
];

export function NavLinks() {
  return <NavLinksView pathname={usePathname()} />;
}

/** Version sans état actif, affichée pendant le pré-rendu. */
export function NavLinksView({ pathname }: { pathname: string | null }) {
  return (
    <nav className="flex gap-1">
      {LINKS.map((l) => {
        const active = !!pathname?.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium",
              active
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800",
            )}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
