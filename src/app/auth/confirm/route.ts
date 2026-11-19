import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { supabaseServer } from "@/lib/supabase/server";
import { claimProfile } from "@/lib/auth/accounts";
import { homeFor } from "@/lib/auth/session";

/** Lien magique reçu par e-mail : /auth/confirm?token_hash=…&type=email */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = (searchParams.get("type") ?? "email") as EmailOtpType;
  const fail = (error: string) => NextResponse.redirect(new URL(`/login?error=${error}`, request.url));

  if (!tokenHash) return fail("invalid_link");

  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
  if (error || !data.user) return fail("expired_link");

  const profile = await claimProfile(data.user);
  if (!profile) {
    await supabase.auth.signOut();
    return fail("no_profile");
  }
  return NextResponse.redirect(new URL(homeFor(profile.role), request.url));
}
