-- Lien d'invitation : le coaché crée lui-même son compte (e-mail + mot de passe)
-- depuis un lien unique généré par le coach. Le jeton est effacé une fois utilisé.
alter table public.athletes
  add column invite_token text unique,
  add column invite_created_at timestamptz;

-- Posé et lu uniquement côté serveur (service_role) : pas de droit d'écriture client.
