import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ChangePasswordForm } from "@/components/change-password-form";
import { Card } from "@/components/ui";
import { getCurrentProfile } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Mon compte" };

async function Account() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  return (
    <div className="mx-auto max-w-md space-y-4">
      <h1 className="text-xl font-semibold">Mon compte</h1>
      <Card>
        <p className="text-sm">
          <span className="text-zinc-500">Nom :</span> {profile.full_name}
        </p>
        <p className="mt-1 text-sm">
          <span className="text-zinc-500">E-mail de connexion :</span> {profile.email}
        </p>
      </Card>
      <Card>
        <h2 className="mb-4 font-medium">Changer mon mot de passe</h2>
        <ChangePasswordForm />
      </Card>
    </div>
  );
}

export default function AccountPage() {
  return (
    <Suspense fallback={<p className="text-sm text-zinc-500">Chargement…</p>}>
      <Account />
    </Suspense>
  );
}
