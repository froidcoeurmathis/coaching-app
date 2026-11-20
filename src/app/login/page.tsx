import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { LoginForm } from "@/components/login-form";
import { Button, Card } from "@/components/ui";
import { signOutAction } from "@/app/actions/auth";
import { getCurrentProfile, getUserId, homeFor } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Connexion" };

async function Login() {
  const userId = await getUserId();
  if (userId) {
    const profile = await getCurrentProfile();
    if (profile) redirect(homeFor(profile.role));
    // Connecté mais sans profil : on propose de se déconnecter (évite une boucle de redirection).
    return (
      <div className="space-y-4 text-sm">
        <p>Votre compte n&apos;est associé à aucun espace coaching.</p>
        <form action={signOutAction}>
          <Button type="submit" variant="secondary">
            Se déconnecter
          </Button>
        </form>
      </div>
    );
  }
  return <LoginForm />;
}

export default function LoginPage() {
  return (
    <div className="mx-auto mt-8 max-w-sm sm:mt-16">
      <Card>
        <h1 className="mb-5 text-lg font-semibold">Connexion</h1>
        <Suspense fallback={<p className="text-sm text-zinc-500">Chargement…</p>}>
          <Login />
        </Suspense>
      </Card>
    </div>
  );
}
