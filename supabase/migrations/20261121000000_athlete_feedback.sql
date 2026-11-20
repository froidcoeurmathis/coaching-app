-- =============================================================================
-- Étape 3 — Espace coaché : validation des séances et ressenti
--
-- Le coaché n'a aucun droit d'écriture direct sur les tables (RLS). Il passe par
-- log_session(), qui ne modifie QUE le statut, l'heure de réalisation, le RPE et
-- le commentaire d'une séance qui lui appartient.
-- =============================================================================

alter table public.sessions
  add constraint sessions_athlete_comment_length
  check (athlete_comment is null or length(athlete_comment) <= 2000);

-- Date de la dernière mise à jour par le coaché (pour signaler les nouveaux retours au coach).
alter table public.sessions add column feedback_at timestamptz;

create or replace function public.log_session(
  p_session_id uuid,
  p_status public.session_status,
  p_rpe smallint default null,
  p_comment text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_athlete_self(public.session_athlete_id(p_session_id)) then
    raise exception 'Séance introuvable' using errcode = '42501';
  end if;
  if p_rpe is not null and (p_rpe < 1 or p_rpe > 10) then
    raise exception 'RPE entre 1 et 10' using errcode = '22023';
  end if;

  update public.sessions s set
    status          = p_status,
    completed_at    = case when p_status = 'done' then coalesce(s.completed_at, now()) end,
    rpe             = case when p_status = 'planned' then null else p_rpe end,
    athlete_comment = case when p_status = 'planned' then null
                           else nullif(left(trim(p_comment), 2000), '') end,
    feedback_at     = case when p_status = 'planned' then null else now() end
  where s.id = p_session_id;
end;
$$;

revoke execute on function public.log_session(uuid, public.session_status, smallint, text) from public, anon;
grant execute on function public.log_session(uuid, public.session_status, smallint, text) to authenticated;
