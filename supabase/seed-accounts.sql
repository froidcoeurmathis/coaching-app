-- Comptes de démo locaux (mot de passe en clair ici : uniquement pour le développement).
--   coach@example.com / coach1234  (coach)
--   clara@example.com / clara1234  (coachée)

update public.athletes set email = 'clara@example.com' where first_name = 'Clara';

create or replace function pg_temp.demo_user(p_email text, p_password text) returns uuid
language plpgsql as $$
declare v_id uuid := gen_random_uuid();
begin
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                          raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                          confirmation_token, email_change, email_change_token_new, recovery_token)
  values ('00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', p_email,
          extensions.crypt(p_password, extensions.gen_salt('bf')), now(),
          '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '');
  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), v_id, v_id::text, jsonb_build_object('sub', v_id::text, 'email', p_email),
          'email', now(), now(), now());
  return v_id;
end;
$$;

update public.profiles set user_id = pg_temp.demo_user('coach@example.com', 'coach1234')
 where email = 'coach@example.com';

with p as (
  insert into public.profiles (user_id, role, full_name, email)
  values (pg_temp.demo_user('clara@example.com', 'clara1234'), 'athlete', 'Clara', 'clara@example.com')
  returning id
)
update public.athletes set profile_id = (select id from p) where first_name = 'Clara';

-- Un retour de démo sur la première séance du programme
update public.sessions
   set status = 'done', completed_at = scheduled_on + time '19:00', rpe = 7, feedback_at = scheduled_on + time '19:05',
       athlete_comment = 'Bonnes sensations sur le squat, cheville OK (1/10).'
 where scheduled_on = '2026-11-02'
   and athlete_id = (select id from public.athletes where first_name = 'Clara');
