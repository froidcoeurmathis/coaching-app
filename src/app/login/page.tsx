import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { LoginForm } from "@/components/login-form";
import { Button, Card } from "@/components/ui";
import { signOutAction } from "@/app/actions/auth";
import { getCurrentProfile, getUserId, homeFor } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Connexion" };

const ERRORS: Record<string, string> = {
  invalid_link: "Lien de connexion invalide.",
  expired_link: "Ce lien a expiré ou a déjà été utilisé. Demandez-en un nouveau.",
  no_profile: "Aucun espace n'est associé à cette adresse. Contactez votre coach.",
};

async function Login({ searchParams }: { searchParams: PageProps<"/login">["searchParams"] }) {
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
  const { error } = await searchParams;
  return <LoginForm initialError={typeof error === "string" ? ERRORS[error] : undefined} />;
}

export default function LoginPage(props: PageProps<"/login">) {
  return (
    <div className="mx-auto mt-8 max-w-sm sm:mt-16">
      <Card>
        <h1 className="text-lg font-semibold">Connexion</h1>
        <p className="mb-5 mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Recevez un lien de connexion par e-mail. Pas de mot de passe à retenir.
        </p>
        <Suspense fallback={<p className="text-sm text-zinc-500">Chargement…</p>}>
          <Login searchParams={props.searchParams} />
        </Suspense>
      </Card>
    </div>
  );
}
