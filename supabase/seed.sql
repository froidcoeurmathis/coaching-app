-- Données de démonstration locales (exécutées par `supabase db reset`, dans l'ordre de
-- [db.seed].sql_paths) : ce fichier, puis data/clara.sql (programme réel de Clara),
-- puis seed-accounts.sql (comptes de démo avec mot de passe).

insert into public.profiles (id, role, full_name, email) values
  ('00000000-0000-0000-0000-000000000001', 'coach', 'Coach Démo', 'coach@example.com');
