# Coaching sportif — Hyrox · Course · Muscu

Application de coaching : le coach gère ses coachés et programme leurs séances dans un
calendrier hebdomadaire. Voir `CLAUDE.md` pour le modèle de données et la feuille de route.

## Démarrer en local

Prérequis : Node 20+, Docker (pour Supabase local).

```bash
npm install
npx supabase start          # lance Postgres + API, applique migrations et données de démo
cp .env.example .env.local  # puis renseigner l'URL et la clé service_role affichées par `npx supabase status`
npm run dev                 # http://localhost:3000
```

## Utiliser un projet Supabase hébergé

1. Créer un projet sur supabase.com.
2. Appliquer le schéma : `npx supabase link --project-ref <ref>` puis `npx supabase db push`
   (ou coller `supabase/migrations/*.sql` dans l'éditeur SQL).
3. Renseigner `NEXT_PUBLIC_SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY` (Project Settings → API)
   dans `.env.local` et, pour le déploiement, dans les variables d'environnement Vercel.

Au premier lancement sans données, l'application demande de créer le profil coach.

> ⚠️ Étape 1 : pas encore d'authentification. Ne déployez pas publiquement avant l'étape 2 :
> toute personne ayant l'URL pourrait modifier les données.
