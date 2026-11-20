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
| `sessions` | Séance planifiée : coaché, date, titre, discipline, consignes, statut (`planned`/`done`/`skipped`), `completed_at`, ressenti coaché (`rpe` 1–10, `athlete_comment`, `feedback_at`) |
| `session_blocks` | Blocs ordonnés d'une séance (lettre A, B, C… calculée depuis `position`) : titre, nombre de tours, repos entre tours, notes |
| `block_exercises` | Exercices d'un bloc (A1, A2… si superset) : exercice, volume (séries, reps, distance, durée), intensité (allure / %FC / RPE), charge (kg ou % de la référence), repos, notes |

Fonctions SQL : `save_session(p_session, p_blocks)` crée/met à jour une séance et remplace ses
blocs en une transaction (les exercices inconnus sont ajoutés à la bibliothèque) ;
`ensure_exercise(coach, nom)`. Plusieurs séances possibles le même jour (`sessions.position`).
Ces fonctions sont SECURITY INVOKER : la RLS s'applique.

## Authentification & sécurité

- Connexion par **e-mail + mot de passe** (`signInWithPassword`). Aucun e-mail n'est envoyé par
  l'appli (pas de SMTP à configurer). L'étape 2 utilisait un lien magique + code : remplacé à
  l'étape 4 à la demande du coach.
- Le **coach** crée l'accès d'un coaché depuis sa fiche (« Créer l'accès » : e-mail de la fiche +
  mot de passe saisi ou généré, affiché une fois pour être transmis) et peut le réinitialiser.
  `createAthleteAccess` / `setPasswordForProfile` dans `src/lib/auth/accounts.ts` (service_role).
- Mot de passe du coach : `npm run set-password -- email "mot de passe"` (script
  `scripts/set-password.mjs`, clé service_role). Première connexion avec `COACH_EMAIL` → profil
  coach créé ou rattaché (`claimProfile`). Chacun change son mot de passe sur `/account`.
- `src/proxy.ts` rafraîchit la session et renvoie les visiteurs vers `/login` ; les layouts
  vérifient le rôle (`requireCoach` / `requireAthlete` dans `src/lib/auth/session.ts`).
- Données métier : client Supabase **lié à l'utilisateur** (`supabaseServer()`), soumis à la RLS.
  `supabaseAdmin()` (service_role) est réservé à `src/lib/auth/accounts.ts`.
- RLS (`supabase/migrations/20261120000000_auth_rls.sql`) : le coach gère ses coachés, leurs
  allures/charges, séances et blocs, sa bibliothèque et ses modèles ; le coaché lit uniquement ses
  données (aucune écriture directe). `profile_id`, `role` et `email` des profils ne sont pas
  modifiables côté client. `athletes.invited_at` est obsolète.

## Espace coaché (étape 3)

- Le coaché valide une séance via `log_session(id, status, rpe, comment)` (SECURITY DEFINER,
  migration `20261121000000_athlete_feedback.sql`) : ne touche que statut, `completed_at`, RPE,
  commentaire et `feedback_at`, et seulement sur ses propres séances. Une séance future ne peut
  pas être validée (contrôle UI). Repasser en « prévue » efface le ressenti.
- `/me` : bandeau des 7 jours (pastilles de statut), séances du jour choisi, compteur de la
  semaine. `/me/sessions/[id]` : détail des blocs, exercices à cocher pendant la séance
  (aide-mémoire local, `localStorage`, non envoyé au coach), formulaire Faite / Pas faite +
  RPE + commentaire.
- Le coach voit le RPE (rouge si ≥ 8) et le commentaire sur les cartes du calendrier et dans
  l'éditeur ; enregistrer la séance côté coach conserve le ressenti.
- PWA : `src/app/manifest.ts`, icônes dans `public/` (+ `src/app/icon.png`, `apple-icon.png`),
  pas de service worker (non requis pour l'installation). Encart d'aide à l'installation sur
  `/me` (Android : bouton natif ; iPhone : instructions, reconnexion dans l'appli installée).
- « Aujourd'hui » et la semaine courante sont calculés en heure de Paris (`todayISO()`,
  `currentWeekStart()` dans `src/lib/format.ts`), jamais avec `new Date()` brut.

## Outils coach (étape 4)

- **Modèles** (`session_templates`, migration `20261122000000_templates.sql`) : contenu d'une
  séance sans date ni coaché, blocs en JSON au format de `save_session`. Créés depuis l'éditeur
  (« Enregistrer comme modèle », remplace un modèle du même nom), appliqués via « Partir d'un
  modèle », gérés sur `/templates`.
- **Copier la semaine** (calendrier) : copie les séances des coachés affichés vers une autre
  semaine (même jour), au statut « prévue », sans les retours ; option vers un autre coaché si
  le calendrier est filtré sur un seul. `copyWeek` dans `src/lib/db/sessions.ts`.
- **Suivi** (`/dashboard`) : par coaché, réalisation de la semaine et des 28 derniers jours
  (faites / pas faites / non validées), RPE moyen (⚠ si ≥ 8), frise jour par jour, dernier
  retour ; liste des derniers retours. Statuts jamais codés par la couleur seule.
- **Calcul automatique** (`src/lib/targets.ts`) : charge en % → kg depuis la charge de
  référence du même exercice (1RM estimé par Epley si > 1 rép., arrondi 0,5 kg) ; une intensité
  qui cite une allure de référence (« Seuil », « Qualité »…) affiche l'allure en min/km. Visible
  dans l'éditeur (indice sous l'exercice) et dans la séance du coaché.
- **Programme réel de Clara** (première coachée) : `supabase/data/clara.sql`, généré par
  `node scripts/generate-clara-program.mjs` (12 cycles de 8 jours, 2 nov. 2026 → 5 févr. 2027,
  72 séances). Idempotent. Sert aussi de données de démo locales.

## IA & statistiques (étape 5)

- **Assistant IA** dans l'éditeur de séance (`src/lib/ai/generate-session.ts`, action
  `src/app/actions/ai.ts`) : génère une séance ou adapte celle de l'éditeur à partir d'une
  demande en français. Contexte envoyé : fiche du coaché, allures et charges de référence,
  séances des 3 dernières semaines (statut, RPE, commentaires), bibliothèque d'exercices.
  SDK `@anthropic-ai/sdk`, `client.beta.messages.parse` + `betaZodOutputFormat` (sortie au format
  des blocs de l'appli), modèle `claude-opus-5-5`, effort `medium`, repli serveur
  `fallbacks: "default"`. Rien n'est enregistré sans validation du coach. Actif seulement si
  `ANTHROPIC_API_KEY` est défini (sinon le bouton est masqué).
- **Progression** sur la fiche coaché (`src/components/athlete-progress.tsx`) : 12 dernières
  semaines, séances faites / prévues, taux de réalisation, temps d'entraînement, répartition par
  discipline, RPE moyen et volume hebdomadaire (minutes réalisées vs prévues).
- Test local de l'IA sans coût : lancer l'appli avec `ANTHROPIC_BASE_URL` pointant vers un faux
  serveur qui renvoie un message au format de l'API.

## Production

- Supabase : projet `coaching-app` (réf. `zelnsxnqijucouvwupyn`, région eu-west-3), migrations
  appliquées via l'API de gestion (table `supabase_migrations.schema_migrations` à jour).
- Vercel : projet `coaching-app` relié au dépôt GitHub, déploiement automatique à chaque push sur
  `main`. URL : https://coaching-app-two-beta.vercel.app

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
- [x] Étape 2 — lien magique + code, invitation des coachés, RLS coach/coaché, proxy et
      redirections par rôle, page provisoire `/me` (séances du coaché en lecture seule)
- [x] Étape 3 — espace coaché mobile (semaine/jour, détail, validation + RPE + commentaire,
      retour visible par le coach, PWA installable)
- [x] Étape 4 — connexion par mot de passe (accès créés par le coach), modèles, copie de
      semaine, tableau de suivi, calcul auto charges/allures, import du programme de Clara
- [x] Étape 5 — assistant IA (génération / adaptation de séances), progression par coaché ;
      mise en production (Supabase + Vercel)

## Routes

- `/login` : connexion (publique) · `/account` : changer son mot de passe (tous)
- Coach (`src/app/(coach)/`) : `/calendar?week=yyyy-MM-dd&athlete=<id>`, `/dashboard`,
  `/athletes` (`?archived=1`), `/athletes/new`, `/athletes/[id]`, `/templates`
- Coaché : `/me?week=yyyy-MM-dd&day=yyyy-MM-dd`, `/me/sessions/[id]`

## Commandes

- `npx supabase start` : Supabase local (Docker) ; `npx supabase db reset` : rejoue migrations + seed
- Seed local : `seed.sql` → `data/clara.sql` → `seed-accounts.sql` (ordre dans `config.toml`)
- Comptes de démo locaux : `coach@example.com` / `coach1234`, `clara@example.com` / `clara1234`
- `npm run set-password -- email "mdp"` · `node scripts/generate-clara-program.mjs`
- `npm run dev` / `npm run build` / `npm run lint`
- Variables : voir `.env.example` (`.env.local` en local)

## Conventions

- Code et noms de tables/colonnes en anglais, interface en français.
- Toute modification du schéma passe par une nouvelle migration dans `supabase/migrations/`.
- Accès base de données uniquement dans `src/lib/db/` (fonctions serveur), jamais depuis un
  composant client.
