// Définit (ou crée) le mot de passe d'un compte, avec la clé service_role.
// Usage : npm run set-password -- coach@exemple.com "mon-mot-de-passe"
// Lit NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY dans l'environnement ou dans .env.local.
import { readFileSync, existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

if (existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const [email, password] = process.argv.slice(2);
if (!email || !password) {
  console.error('Usage : npm run set-password -- adresse@email.com "mot de passe"');
  process.exit(1);
}
if (password.length < 8) {
  console.error("Le mot de passe doit contenir au moins 8 caractères.");
  process.exit(1);
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requis (variables d'environnement ou .env.local).");
  process.exit(1);
}

const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const normalized = email.trim().toLowerCase();

const { data: created, error } = await db.auth.admin.createUser({ email: normalized, password, email_confirm: true });
if (!error) {
  console.log(`Compte créé pour ${normalized}.`);
} else if (error.code === "email_exists") {
  // Recherche du compte existant puis mise à jour du mot de passe.
  let user = null;
  for (let page = 1; !user; page++) {
    const { data, error: e } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (e) throw e;
    user = data.users.find((u) => u.email?.toLowerCase() === normalized) ?? null;
    if (data.users.length < 200) break;
  }
  if (!user) throw new Error("Compte introuvable.");
  const { error: e2 } = await db.auth.admin.updateUserById(user.id, { password });
  if (e2) throw e2;
  console.log(`Mot de passe mis à jour pour ${normalized}.`);
} else {
  throw error;
}
void created;
console.log("Connectez-vous sur /login avec cette adresse et ce mot de passe.");
