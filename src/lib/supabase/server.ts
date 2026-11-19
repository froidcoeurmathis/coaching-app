import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export function supabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Variables NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY manquantes (voir .env.example).",
    );
  }
  return { url, key };
}

/**
 * Client Supabase lié à l'utilisateur connecté (cookies de session).
 * Toutes les requêtes sont soumises aux politiques RLS.
 */
export async function supabaseServer(): Promise<SupabaseClient> {
  const { url, key } = supabaseEnv();
  const cookieStore = await cookies();
  return createServerClient(url, key, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(list) {
        try {
          for (const { name, value, options } of list) cookieStore.set(name, value, options);
        } catch {
          // Appelé depuis un Server Component : les cookies sont rafraîchis par le proxy.
        }
      },
    },
  });
}

/**
 * Client sans session, pour envoyer un lien de connexion à quelqu'un d'autre
 * que l'utilisateur courant (invitation) sans toucher à ses cookies.
 */
export function supabaseAnonymous(): SupabaseClient {
  const { url, key } = supabaseEnv();
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, flowType: "implicit" },
  });
}
