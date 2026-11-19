-- =============================================================================
-- Étape 2 — Authentification & rôles : politiques RLS
--
-- Principe : chaque utilisateur connecté (auth.uid()) est relié à un profil
-- (profiles.user_id). Un coach accède à tout ce qui concerne SES coachés ;
-- un coaché ne voit que ses propres données (lecture seule pour l'instant —
-- la validation des séances passera par une fonction dédiée à l'étape 3).
-- La création/le rattachement des profils se fait côté serveur (service_role).
-- =============================================================================

-- Date du dernier envoi d'invitation à un coaché (posée côté serveur).
alter table public.athletes add column invited_at timestamptz;

-- E-mails comparés sans tenir compte de la casse.
create index profiles_email_lower_idx on public.profiles (lower(email));
create index athletes_email_lower_idx on public.athletes (lower(email));

-- ---------------------------------------------------------------------------
-- Fonctions utilitaires (SECURITY DEFINER pour éviter la récursion RLS)
-- ---------------------------------------------------------------------------

create or replace function public.current_profile_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from public.profiles where user_id = auth.uid()
$$;

create or replace function public.is_coach_of_athlete(p_athlete_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.athletes a
    join public.profiles p on p.id = a.coach_id
    where a.id = p_athlete_id and p.user_id = auth.uid() and p.role = 'coach'
  )
$$;

create or replace function public.is_athlete_self(p_athlete_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.athletes a
    join public.profiles p on p.id = a.profile_id
    where a.id = p_athlete_id and p.user_id = auth.uid()
  )
$$;

create or replace function public.can_read_athlete(p_athlete_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_coach_of_athlete(p_athlete_id) or public.is_athlete_self(p_athlete_id)
$$;

create or replace function public.session_athlete_id(p_session_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select athlete_id from public.sessions where id = p_session_id
$$;

create or replace function public.block_session_id(p_block_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select session_id from public.session_blocks where id = p_block_id
$$;

revoke execute on function
  public.current_profile_id(),
  public.is_coach_of_athlete(uuid),
  public.is_athlete_self(uuid),
  public.can_read_athlete(uuid),
  public.session_athlete_id(uuid),
  public.block_session_id(uuid)
from public, anon;

grant execute on function
  public.current_profile_id(),
  public.is_coach_of_athlete(uuid),
  public.is_athlete_self(uuid),
  public.can_read_athlete(uuid),
  public.session_athlete_id(uuid),
  public.block_session_id(uuid)
to authenticated;

-- ---------------------------------------------------------------------------
-- profiles : chacun lit son profil ; le coach lit les profils de ses coachés.
-- Seul le nom est modifiable par l'utilisateur (pas le rôle ni l'e-mail).
-- ---------------------------------------------------------------------------
create policy "profiles: lecture de son profil"
  on public.profiles for select to authenticated
  using (user_id = auth.uid());

create policy "profiles: le coach lit ses coachés"
  on public.profiles for select to authenticated
  using (exists (
    select 1 from public.athletes a
    where a.profile_id = profiles.id and a.coach_id = public.current_profile_id()
  ));

create policy "profiles: modification de son profil"
  on public.profiles for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

revoke insert, update, delete on public.profiles from anon, authenticated;
grant update (full_name) on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- athletes
-- ---------------------------------------------------------------------------
create policy "athletes: le coach gère ses coachés"
  on public.athletes for all to authenticated
  using (coach_id = public.current_profile_id())
  with check (coach_id = public.current_profile_id());

create policy "athletes: le coaché lit sa fiche"
  on public.athletes for select to authenticated
  using (profile_id = public.current_profile_id());

-- Le lien vers le compte (profile_id) n'est posé que côté serveur :
-- on restreint les colonnes modifiables par les utilisateurs connectés.
revoke insert, update on public.athletes from anon, authenticated;
grant insert (coach_id, first_name, last_name, email, goal, target_event, target_date,
              vma_kmh, hr_max, hr_rest, notes)
  on public.athletes to authenticated;
grant update (first_name, last_name, email, goal, target_event, target_date,
              vma_kmh, hr_max, hr_rest, notes, archived_at)
  on public.athletes to authenticated;

-- ---------------------------------------------------------------------------
-- athlete_paces / athlete_reference_loads
-- ---------------------------------------------------------------------------
create policy "paces: le coach gère"
  on public.athlete_paces for all to authenticated
  using (public.is_coach_of_athlete(athlete_id))
  with check (public.is_coach_of_athlete(athlete_id));

create policy "paces: le coaché lit"
  on public.athlete_paces for select to authenticated
  using (public.is_athlete_self(athlete_id));

create policy "reference_loads: le coach gère"
  on public.athlete_reference_loads for all to authenticated
  using (public.is_coach_of_athlete(athlete_id))
  with check (public.is_coach_of_athlete(athlete_id));

create policy "reference_loads: le coaché lit"
  on public.athlete_reference_loads for select to authenticated
  using (public.is_athlete_self(athlete_id));

-- ---------------------------------------------------------------------------
-- exercises : le coach gère sa bibliothèque ; ses coachés la lisent
-- (nécessaire pour afficher le nom des exercices dans leurs séances).
-- ---------------------------------------------------------------------------
create policy "exercises: le coach gère"
  on public.exercises for all to authenticated
  using (coach_id = public.current_profile_id())
  with check (coach_id = public.current_profile_id());

create policy "exercises: les coachés lisent la bibliothèque de leur coach"
  on public.exercises for select to authenticated
  using (exists (
    select 1 from public.athletes a
    where a.coach_id = exercises.coach_id and a.profile_id = public.current_profile_id()
  ));

-- ---------------------------------------------------------------------------
-- sessions / session_blocks / block_exercises
-- ---------------------------------------------------------------------------
create policy "sessions: le coach gère"
  on public.sessions for all to authenticated
  using (public.is_coach_of_athlete(athlete_id))
  with check (public.is_coach_of_athlete(athlete_id));

create policy "sessions: le coaché lit"
  on public.sessions for select to authenticated
  using (public.is_athlete_self(athlete_id));

create policy "blocks: le coach gère"
  on public.session_blocks for all to authenticated
  using (public.is_coach_of_athlete(public.session_athlete_id(session_id)))
  with check (public.is_coach_of_athlete(public.session_athlete_id(session_id)));

create policy "blocks: le coaché lit"
  on public.session_blocks for select to authenticated
  using (public.is_athlete_self(public.session_athlete_id(session_id)));

create policy "block_exercises: le coach gère"
  on public.block_exercises for all to authenticated
  using (public.is_coach_of_athlete(public.session_athlete_id(public.block_session_id(block_id))))
  with check (public.is_coach_of_athlete(public.session_athlete_id(public.block_session_id(block_id))));

create policy "block_exercises: le coaché lit"
  on public.block_exercises for select to authenticated
  using (public.is_athlete_self(public.session_athlete_id(public.block_session_id(block_id))));

-- ---------------------------------------------------------------------------
-- Fonctions métier : exécutées avec les droits de l'appelant (RLS appliquée).
-- ---------------------------------------------------------------------------
grant execute on function public.save_session(jsonb, jsonb) to authenticated;
grant execute on function public.ensure_exercise(uuid, text, public.discipline) to authenticated;

-- save_session et ensure_exercise sont SECURITY INVOKER : la RLS s'applique à
-- chaque insert/update (un coaché qui l'appellerait se verrait refuser l'écriture).
