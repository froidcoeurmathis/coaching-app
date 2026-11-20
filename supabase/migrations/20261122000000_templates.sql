-- =============================================================================
-- Étape 4 — Outils coach : modèles de séances réutilisables
-- Un modèle = le contenu d'une séance (titre, discipline, consignes, durée, blocs)
-- sans date ni coaché. Les blocs sont stockés au format attendu par save_session.
-- =============================================================================

create table public.session_templates (
  id            uuid primary key default gen_random_uuid(),
  coach_id      uuid not null references public.profiles (id) on delete cascade,
  name          text not null check (length(trim(name)) > 0 and length(name) <= 120),
  title         text not null check (length(trim(title)) > 0),
  discipline    public.discipline not null default 'other',
  description   text,
  duration_min  smallint check (duration_min is null or duration_min between 1 and 600),
  blocks        jsonb not null default '[]'::jsonb check (jsonb_typeof(blocks) = 'array'),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create unique index session_templates_coach_name_uniq on public.session_templates (coach_id, lower(name));

create trigger session_templates_updated_at before update on public.session_templates
  for each row execute function public.set_updated_at();

alter table public.session_templates enable row level security;

create policy "templates: le coach gère les siens"
  on public.session_templates for all to authenticated
  using (coach_id = public.current_profile_id())
  with check (coach_id = public.current_profile_id());

-- La colonne invited_at (invitations par e-mail, étape 2) n'est plus utilisée :
-- les accès sont désormais créés par le coach avec un mot de passe.
comment on column public.athletes.invited_at is 'Obsolète (ancien envoi d''invitation par e-mail).';
