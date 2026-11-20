import type { Metadata } from "next";
import { Suspense } from "react";
import { JoinForm } from "@/components/join-form";
import { Card } from "@/components/ui";
import { getInvite } from "@/lib/auth/accounts";
import { connection } from "next/server";

export const metadata: Metadata = { title: "Créer mon compte" };

async function Join({ params }: { params: PageProps<"/join/[token]">["params"] }) {
  await connection();
  const { token } = await params;
  const invite = await getInvite(token);
  if (!invite) {
    return (
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Ce lien d&apos;invitation n&apos;est plus valable (déjà utilisé ou remplacé). Si vous avez déjà créé votre compte,{" "}
        <a href="/login" className="font-medium text-zinc-900 underline dark:text-zinc-100">connectez-vous</a>. Sinon, demandez un
        nouveau lien à votre coach.
      </p>
    );
  }
  return (
    <>
      <p className="mb-5 text-sm text-zinc-600 dark:text-zinc-400">
        Bonjour {invite.firstName} ! {invite.coachName} vous invite à retrouver vos séances. Choisissez l&apos;adresse e-mail et le
        mot de passe avec lesquels vous vous connecterez.
      </p>
      <JoinForm token={token} />
    </>
  );
}

export default function JoinPage(props: PageProps<"/join/[token]">) {
  return (
    <div className="mx-auto mt-8 max-w-sm sm:mt-16">
      <Card>
        <h1 className="mb-2 text-lg font-semibold">Créer mon compte</h1>
        <Suspense fallback={<p className="text-sm text-zinc-500">Chargement…</p>}>
          <Join params={props.params} />
        </Suspense>
      </Card>
    </div>
  );
}
