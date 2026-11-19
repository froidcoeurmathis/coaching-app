-- Données de démonstration (exécutées par `supabase db reset` en local uniquement).

insert into public.profiles (id, role, full_name, email) values
  ('00000000-0000-0000-0000-000000000001', 'coach', 'Coach Démo', 'coach@example.com');

insert into public.athletes (id, coach_id, first_name, last_name, email, goal, target_event,
                             target_date, vma_kmh, hr_max, hr_rest, notes)
values (
  '00000000-0000-0000-0000-0000000000a1',
  '00000000-0000-0000-0000-000000000001',
  'Camille', 'Martin', 'camille@example.com',
  'Finir son premier Hyrox en moins de 1h30',
  'Hyrox Paris — Open', current_date + 120,
  15.5, 192, 52,
  'Ancienne nageuse, bon cardio, technique de wall ball à travailler.'
);

insert into public.athlete_paces (athlete_id, position, label, pace_s_per_km) values
  ('00000000-0000-0000-0000-0000000000a1', 0, 'Endurance fondamentale', 360),
  ('00000000-0000-0000-0000-0000000000a1', 1, 'Seuil', 290),
  ('00000000-0000-0000-0000-0000000000a1', 2, 'VMA', 232);

insert into public.exercises (id, coach_id, name, discipline) values
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-000000000001', 'Back squat', 'strength'),
  ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-000000000001', 'Soulevé de terre', 'strength'),
  ('00000000-0000-0000-0000-0000000000e3', '00000000-0000-0000-0000-000000000001', 'Wall balls', 'hyrox'),
  ('00000000-0000-0000-0000-0000000000e4', '00000000-0000-0000-0000-000000000001', 'SkiErg', 'hyrox'),
  ('00000000-0000-0000-0000-0000000000e5', '00000000-0000-0000-0000-000000000001', 'Sled push', 'hyrox'),
  ('00000000-0000-0000-0000-0000000000e6', '00000000-0000-0000-0000-000000000001', 'Course', 'running'),
  ('00000000-0000-0000-0000-0000000000e7', '00000000-0000-0000-0000-000000000001', 'Fentes marchées', 'strength');

insert into public.athlete_reference_loads (athlete_id, exercise_id, load_kg, reps, tested_on) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000e1', 80, 1, current_date - 14),
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000e2', 100, 1, current_date - 14);

-- Deux séances dans la semaine en cours
select public.save_session(
  jsonb_build_object(
    'athlete_id', '00000000-0000-0000-0000-0000000000a1',
    'scheduled_on', date_trunc('week', current_date)::date,
    'title', 'Force + Hyrox', 'discipline', 'strength',
    'description', 'Échauffement 10 min mobilité hanches.', 'duration_min', 75
  ),
  '[
    {"exercises": [{"name": "Back squat", "sets": 5, "reps": "5", "load_pct": 75, "rest_s": 150}]},
    {"rounds": 3, "rest_s": 90, "exercises": [
      {"name": "Fentes marchées", "reps": "20", "load_kg": 10, "notes": "1 haltère de 10 kg par main"},
      {"name": "Wall balls", "reps": "15", "load_kg": 6}
    ]},
    {"title": "Finisher", "exercises": [{"name": "SkiErg", "sets": 4, "distance_m": 250, "intensity": "RPE 8", "rest_s": 60}]}
  ]'::jsonb
);

select public.save_session(
  jsonb_build_object(
    'athlete_id', '00000000-0000-0000-0000-0000000000a1',
    'scheduled_on', date_trunc('week', current_date)::date + 2,
    'title', 'Fractionné seuil', 'discipline', 'running', 'duration_min', 60
  ),
  '[
    {"title": "Échauffement", "exercises": [{"name": "Course", "duration_s": 900, "intensity": "EF"}]},
    {"exercises": [{"name": "Course", "sets": 5, "distance_m": 1000, "intensity": "Seuil (4''50/km)", "rest_s": 90}]},
    {"title": "Retour au calme", "exercises": [{"name": "Course", "duration_s": 600, "intensity": "EF"}]}
  ]'::jsonb
);
