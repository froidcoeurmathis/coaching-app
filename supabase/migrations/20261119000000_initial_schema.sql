-- =============================================================================
-- Étape 1 — Modèle de données complet
-- Coach / coachés, fiches (objectif, allures, FC, charges de référence),
-- bibliothèque d'exercices, séances composées de blocs lettrés (A, B, C…)
-- contenant un ou plusieurs exercices (A1, A2… pour les supersets).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
create type public.user_role as enum ('coach', 'athlete');
create type public.discipline as enum ('hyrox', 'running', 'strength', 'other');
create type public.session_status as enum ('planned', 'done', 'skipped');

-- ---------------------------------------------------------------------------
-- updated_at automatique
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles : une personne de l'application, avec son rôle.
-- user_id sera relié à auth.users à l'étape 2 (nullable d'ici là : un coaché
-- peut exister avant d'avoir créé son compte).
-- ---------------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid unique references auth.users (id) on delete set null,
  role        public.user_role not null,
  full_name   text not null check (length(trim(full_name)) > 0),
  email       text unique,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- athletes : fiche coaché, gérée par un coach.
-- profile_id = compte de connexion du coaché (rempli à l'étape 2).
-- ---------------------------------------------------------------------------
create table public.athletes (
  id            uuid primary key default gen_random_uuid(),
  coach_id      uuid not null references public.profiles (id) on delete cascade,
  profile_id    uuid unique references public.profiles (id) on delete set null,
  first_name    text not null check (length(trim(first_name)) > 0),
  last_name     text,
  email         text,
  goal          text,                 -- objectif en texte libre
  target_event  text,                 -- ex. « Hyrox Paris — Pro »
  target_date   date,
  vma_kmh       numeric(4, 1) check (vma_kmh is null or vma_kmh between 5 and 30),
  hr_max        smallint check (hr_max is null or hr_max between 100 and 240),
  hr_rest       smallint check (hr_rest is null or hr_rest between 25 and 120),
  notes         text,
  archived_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index athletes_coach_idx on public.athletes (coach_id);

create trigger athletes_updated_at before update on public.athletes
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- athlete_paces : allures de référence (EF, Seuil, VMA, 10 km…)
-- ---------------------------------------------------------------------------
create table public.athlete_paces (
  id              uuid primary key default gen_random_uuid(),
  athlete_id      uuid not null references public.athletes (id) on delete cascade,
  position        smallint not null default 0,
  label           text not null check (length(trim(label)) > 0),
  pace_s_per_km   integer not null check (pace_s_per_km between 120 and 1200),
  notes           text,
  created_at      timestamptz not null default now()
);

create index athlete_paces_athlete_idx on public.athlete_paces (athlete_id, position);

-- ---------------------------------------------------------------------------
-- exercises : bibliothèque d'exercices du coach (alimentée automatiquement
-- quand un nouvel exercice est saisi dans une séance ou une charge de réf.)
-- ---------------------------------------------------------------------------
create table public.exercises (
  id          uuid primary key default gen_random_uuid(),
  coach_id    uuid not null references public.profiles (id) on delete cascade,
  name        text not null check (length(trim(name)) > 0),
  discipline  public.discipline not null default 'other',
  notes       text,
  created_at  timestamptz not null default now()
);

create unique index exercises_coach_name_uniq on public.exercises (coach_id, lower(name));

-- ---------------------------------------------------------------------------
-- athlete_reference_loads : charges de référence (1RM, 5RM…)
-- ---------------------------------------------------------------------------
create table public.athlete_reference_loads (
  id           uuid primary key default gen_random_uuid(),
  athlete_id   uuid not null references public.athletes (id) on delete cascade,
  exercise_id  uuid not null references public.exercises (id) on delete restrict,
  load_kg      numeric(6, 2) not null check (load_kg >= 0),
  reps         smallint not null default 1 check (reps between 1 and 50),
  tested_on    date,
  notes        text,
  created_at   timestamptz not null default now()
);

create index athlete_reference_loads_athlete_idx on public.athlete_reference_loads (athlete_id);

-- ---------------------------------------------------------------------------
-- sessions : séance planifiée pour un coaché à une date donnée.
-- Plusieurs séances possibles le même jour (ordonnées par position).
-- ---------------------------------------------------------------------------
create table public.sessions (
  id               uuid primary key default gen_random_uuid(),
  athlete_id       uuid not null references public.athletes (id) on delete cascade,
  scheduled_on     date not null,
  position         smallint not null default 0,
  title            text not null check (length(trim(title)) > 0),
  discipline       public.discipline not null default 'other',
  description      text,               -- consignes générales du coach
  duration_min     smallint check (duration_min is null or duration_min between 1 and 600),
  status           public.session_status not null default 'planned',
  completed_at     timestamptz,
  -- Retour du coaché (étape 3)
  rpe              smallint check (rpe is null or rpe between 1 and 10),
  athlete_comment  text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint sessions_completed_consistency
    check ((status = 'done') = (completed_at is not null))
);

create index sessions_athlete_date_idx on public.sessions (athlete_id, scheduled_on, position);
create index sessions_date_idx on public.sessions (scheduled_on);

create trigger sessions_updated_at before update on public.sessions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- session_blocks : blocs lettrés d'une séance. La lettre (A, B, C…) est
-- déduite de position (0 → A). rounds = nombre de tours pour un superset/circuit.
-- ---------------------------------------------------------------------------
create table public.session_blocks (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references public.sessions (id) on delete cascade,
  position    smallint not null check (position between 0 and 25),
  title       text,                    -- ex. « Échauffement », « EMOM 12' »
  rounds      smallint check (rounds is null or rounds between 1 and 100),
  rest_s      integer check (rest_s is null or rest_s between 0 and 3600), -- repos entre tours
  notes       text,
  unique (session_id, position) deferrable initially deferred
);

-- ---------------------------------------------------------------------------
-- block_exercises : exercices d'un bloc (A1, A2… si plusieurs).
-- Volume : séries × reps, distance ou durée. Intensité : allure, %FC, RPE…
-- Charge : en kg ou en % de la charge de référence du coaché.
-- ---------------------------------------------------------------------------
create table public.block_exercises (
  id           uuid primary key default gen_random_uuid(),
  block_id     uuid not null references public.session_blocks (id) on delete cascade,
  position     smallint not null check (position between 0 and 50),
  exercise_id  uuid not null references public.exercises (id) on delete restrict,
  sets         smallint check (sets is null or sets between 1 and 100),
  reps         text,                   -- texte pour accepter « 8-10 », « max »…
  distance_m   integer check (distance_m is null or distance_m between 1 and 100000),
  duration_s   integer check (duration_s is null or duration_s between 1 and 86400),
  intensity    text,                   -- ex. « 4'30/km », « Z2 », « RPE 8 »
  load_kg      numeric(6, 2) check (load_kg is null or load_kg >= 0),
  load_pct     numeric(5, 2) check (load_pct is null or load_pct between 0 and 200),
  rest_s       integer check (rest_s is null or rest_s between 0 and 3600),
  notes        text,
  unique (block_id, position) deferrable initially deferred
);

create index block_exercises_exercise_idx on public.block_exercises (exercise_id);

-- ---------------------------------------------------------------------------
-- save_session : crée ou met à jour une séance et remplace ses blocs en une
-- seule transaction. Les exercices inconnus sont ajoutés à la bibliothèque.
--
-- p_session : { id?, athlete_id, scheduled_on, title, discipline, description,
--               duration_min, status }
-- p_blocks  : [ { title, rounds, rest_s, notes,
--                 exercises: [ { name, sets, reps, distance_m, duration_s,
--                                intensity, load_kg, load_pct, rest_s, notes } ] } ]
-- ---------------------------------------------------------------------------
create or replace function public.save_session(p_session jsonb, p_blocks jsonb)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_session_id  uuid := nullif(p_session ->> 'id', '')::uuid;
  v_athlete_id  uuid := (p_session ->> 'athlete_id')::uuid;
  v_coach_id    uuid;
  v_status      public.session_status := coalesce(p_session ->> 'status', 'planned')::public.session_status;
  v_date        date := (p_session ->> 'scheduled_on')::date;
  v_discipline  public.discipline := coalesce(p_session ->> 'discipline', 'other')::public.discipline;
  v_block       jsonb;
  v_block_id    uuid;
  v_block_pos   int := 0;
  v_ex          jsonb;
  v_ex_pos      int;
  v_ex_name     text;
  v_exercise_id uuid;
begin
  select coach_id into v_coach_id from public.athletes where id = v_athlete_id;
  if v_coach_id is null then
    raise exception 'Coaché introuvable';
  end if;

  if v_session_id is null then
    insert into public.sessions (athlete_id, scheduled_on, position, title, discipline,
                                 description, duration_min, status, completed_at)
    values (
      v_athlete_id, v_date,
      (select coalesce(max(position) + 1, 0) from public.sessions
        where athlete_id = v_athlete_id and scheduled_on = v_date),
      p_session ->> 'title', v_discipline,
      nullif(p_session ->> 'description', ''),
      nullif(p_session ->> 'duration_min', '')::smallint,
      v_status,
      case when v_status = 'done' then now() end
    )
    returning id into v_session_id;
  else
    update public.sessions s set
      athlete_id   = v_athlete_id,
      position     = case when s.scheduled_on = v_date and s.athlete_id = v_athlete_id then s.position
                          else (select coalesce(max(position) + 1, 0) from public.sessions
                                 where athlete_id = v_athlete_id and scheduled_on = v_date) end,
      scheduled_on = v_date,
      title        = p_session ->> 'title',
      discipline   = v_discipline,
      description  = nullif(p_session ->> 'description', ''),
      duration_min = nullif(p_session ->> 'duration_min', '')::smallint,
      status       = v_status,
      completed_at = case when v_status = 'done' then coalesce(s.completed_at, now()) end
    where s.id = v_session_id;

    if not found then
      raise exception 'Séance introuvable';
    end if;

    delete from public.session_blocks where session_id = v_session_id;
  end if;

  for v_block in select * from jsonb_array_elements(coalesce(p_blocks, '[]'::jsonb))
  loop
    insert into public.session_blocks (session_id, position, title, rounds, rest_s, notes)
    values (
      v_session_id, v_block_pos,
      nullif(v_block ->> 'title', ''),
      nullif(v_block ->> 'rounds', '')::smallint,
      nullif(v_block ->> 'rest_s', '')::int,
      nullif(v_block ->> 'notes', '')
    )
    returning id into v_block_id;

    v_ex_pos := 0;
    for v_ex in select * from jsonb_array_elements(coalesce(v_block -> 'exercises', '[]'::jsonb))
    loop
      v_ex_name := trim(v_ex ->> 'name');
      if v_ex_name is null or v_ex_name = '' then
        continue;
      end if;

      select id into v_exercise_id from public.exercises
        where coach_id = v_coach_id and lower(name) = lower(v_ex_name);
      if v_exercise_id is null then
        insert into public.exercises (coach_id, name, discipline)
        values (v_coach_id, v_ex_name, v_discipline)
        returning id into v_exercise_id;
      end if;

      insert into public.block_exercises (block_id, position, exercise_id, sets, reps,
                                          distance_m, duration_s, intensity, load_kg,
                                          load_pct, rest_s, notes)
      values (
        v_block_id, v_ex_pos, v_exercise_id,
        nullif(v_ex ->> 'sets', '')::smallint,
        nullif(v_ex ->> 'reps', ''),
        nullif(v_ex ->> 'distance_m', '')::int,
        nullif(v_ex ->> 'duration_s', '')::int,
        nullif(v_ex ->> 'intensity', ''),
        nullif(v_ex ->> 'load_kg', '')::numeric,
        nullif(v_ex ->> 'load_pct', '')::numeric,
        nullif(v_ex ->> 'rest_s', '')::int,
        nullif(v_ex ->> 'notes', '')
      );
      v_ex_pos := v_ex_pos + 1;
    end loop;

    v_block_pos := v_block_pos + 1;
  end loop;

  return v_session_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- ensure_exercise : renvoie l'id d'un exercice du coach, en le créant au besoin.
-- ---------------------------------------------------------------------------
create or replace function public.ensure_exercise(p_coach_id uuid, p_name text,
                                                  p_discipline public.discipline default 'other')
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_id uuid;
begin
  select id into v_id from public.exercises
    where coach_id = p_coach_id and lower(name) = lower(trim(p_name));
  if v_id is null then
    insert into public.exercises (coach_id, name, discipline)
    values (p_coach_id, trim(p_name), p_discipline)
    returning id into v_id;
  end if;
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Sécurité : RLS activée partout. Aucune politique pour l'instant :
-- les rôles anon/authenticated n'ont accès à rien. L'application (étape 1)
-- passe par la clé service_role côté serveur uniquement.
-- Les politiques coach / coaché seront ajoutées à l'étape 2.
-- ---------------------------------------------------------------------------
alter table public.profiles                enable row level security;
alter table public.athletes                enable row level security;
alter table public.athlete_paces           enable row level security;
alter table public.exercises               enable row level security;
alter table public.athlete_reference_loads enable row level security;
alter table public.sessions                enable row level security;
alter table public.session_blocks          enable row level security;
alter table public.block_exercises         enable row level security;

revoke execute on function public.save_session(jsonb, jsonb) from public, anon, authenticated;
revoke execute on function public.ensure_exercise(uuid, text, public.discipline) from public, anon, authenticated;
