# Coaching sportif — Hyrox · Course · Muscu

Application web de coaching : un coach programme les séances de ses coachés dans un calendrier
hebdomadaire ; chaque coaché consulte ses séances sur mobile et les coche quand elles sont faites.

- Démarrage : 1 coach, 1 coachée. Dimensionnement cible : une dizaine de coachés (un seul coach
  pour l'instant, mais le modèle de données reste multi-coach : tout est rattaché à un `coach_id`).
- Langue de l'interface : français. Semaine du lundi au dimanche. Fuseau : Europe/Paris.

## Stack

- **Next.js** (App Router, TypeScript, Server Components + Server Actions)
- **Supabase** : Postgres (base de données) + Auth (à partir de l'étape 2)
- **Vercel** : hébergement
- UI : Tailwind CSS v4 + petits composants maison (`src/components/ui.tsx`), mobile-first pour l'espace coaché
- Validation : zod · Dates : date-fns (locale `fr`)
- Migrations SQL versionnées dans `supabase/migrations/`, types métier dans `src/lib/db/types.ts`
- Next.js 16 avec `cacheComponents` activé : toute lecture de données se fait dans un composant
  enveloppé de `<Suspense>` et après `await connection()` (voir `src/lib/db/*`). Lire la doc
  embarquée `node_modules/next/dist/docs/` avant d'utiliser une API Next (cf. AGENTS.md).

## Modèle de données (résumé)

| Table | Rôle |
|---|---|
| `profiles` | Un utilisateur authentifié (lié à `auth.users` à l'étape 2) avec `role` = `coach` \| `athlete` |
| `athletes` | Fiche coaché : `coach_id`, `profile_id` (nullable tant que le compte n'est pas créé), nom, objectif, date/course cible, FC max, FC repos, notes, actif/archivé |
| `athlete_paces` | Allures de référence d'un coaché (ex. EF, Seuil, VMA, allure 10 km) en s/km |
| `exercises` | Bibliothèque d'exercices du coach (nom, discipline `hyrox`/`running`/`strength`) |
| `athlete_reference_loads` | Charges de référence (exercice, charge kg, nb de reps : 1RM, 5RM…, date du test) |
| `sessions` | Séance planifiée : coaché, date, titre, discipline, consignes, statut (`planned`/`done`/`skipped`), `completed_at`, ressenti coaché (RPE, commentaire — utilisé à l'étape 3) |
| `session_blocks` | Blocs ordonnés d'une séance (lettre A, B, C… calculée depuis `position`) : titre, nombre de tours, repos entre tours, notes |
| `block_exercises` | Exercices d'un bloc (A1, A2… si superset) : exercice, volume (séries, reps, distance, durée), intensité (allure / %FC / RPE), charge (kg ou % de la référence), repos, notes |

Fonctions SQL : `save_session(p_session, p_blocks)` crée/met à jour une séance et remplace ses
blocs en une transaction (les exercices inconnus sont ajoutés à la bibliothèque) ;
`ensure_exercise(coach, nom)`. Plusieurs séances possibles le même jour (`sessions.position`).
Étape 1 sans auth : le « coach courant » est l'unique profil `coach` (`getCurrentCoach`), créé
via un formulaire d'accueil s'il n'existe pas.

Sécurité : RLS activée sur toutes les tables dès l'étape 1. Sans auth, l'app accède à la base
uniquement côté serveur (clé `service_role`, jamais exposée au navigateur). Les politiques RLS
coach/coaché sont écrites à l'étape 2.

## Plan en 5 étapes

1. **Modèle de données + espace coach (sans auth)** — schéma complet avec rôles, liste et fiche
   des coachés (objectif, allures, FC max, charges de référence), calendrier hebdo pour créer,
   modifier, dupliquer et supprimer des séances composées de blocs A, B, C…
2. **Authentification & rôles** — Supabase Auth (lien magique par e-mail), invitation d'un coaché
   par le coach, politiques RLS (le coach voit ses coachés, le coaché ne voit que ses séances),
   middleware de redirection selon le rôle.
3. **Espace coaché mobile** — vue semaine/jour de ses séances, détail des blocs, cocher « fait »,
   ressenti (RPE + commentaire), installable sur l'écran d'accueil (PWA).
4. **Outils coach avancés** — modèles de séances réutilisables, copie d'une semaine, tableau de
   suivi (taux de réalisation, ressentis), calcul automatique des allures/charges depuis les
   références du coaché.
5. **IA & statistiques** — assistant de génération/adaptation de séances, historique et
   progression, éventuelles intégrations (Strava…).

## État d'avancement

- [x] Étape 1 — schéma + seed, liste/fiche coachés (allures, charges de réf., archivage),
      calendrier hebdo (grille coachés × jours, filtre, navigation), éditeur de séance
      (blocs, supersets, réordonnancement, statut, duplication, suppression)
- [ ] Étape 2 — authentification & rôles

## Routes

- `/calendar?week=yyyy-MM-dd&athlete=<id>` : calendrier hebdo du coach
- `/athletes` (`?archived=1`), `/athletes/new`, `/athletes/[id]` : coachés

## Commandes

- `npx supabase start` : Supabase local (Docker) ; `npx supabase db reset` : rejoue migrations + seed
- `npm run dev` / `npm run build` / `npm run lint`
- Variables : voir `.env.example` (`.env.local` en local)

## Conventions

- Code et noms de tables/colonnes en anglais, interface en français.
- Toute modification du schéma passe par une nouvelle migration dans `supabase/migrations/`.
- Accès base de données uniquement dans `src/lib/db/` (fonctions serveur), jamais depuis un
  composant client.
