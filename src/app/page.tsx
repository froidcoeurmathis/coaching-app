import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getCurrentProfile, homeFor } from "@/lib/auth/session";

async function RedirectByRole(): Promise<null> {
  const profile = await getCurrentProfile();
  redirect(profile ? homeFor(profile.role) : "/login");
}

export default function Home() {
  return (
    <Suspense>
      <RedirectByRole />
    </Suspense>
  );
}
