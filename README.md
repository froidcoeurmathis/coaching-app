# Coaching sportif — Hyrox · Course · Muscu

Application de coaching : le coach gère ses coachés et programme leurs séances dans un
calendrier hebdomadaire ; chaque coaché se connecte et voit uniquement ses séances.
Voir `CLAUDE.md` pour le modèle de données, la sécurité et la feuille de route.

## Démarrer en local

Prérequis : Node 20+, Docker (pour Supabase local).

```bash
npm install
npx supabase start          # Postgres, Auth, API et boîte mail de test ; applique migrations + données de démo
cp .env.example .env.local  # renseigner les valeurs affichées par `npx supabase status`, et COACH_EMAIL=coach@example.com
npm run dev                 # http://localhost:3000
```

Connectez-vous avec `coach@example.com` (coach) ou `camille@example.com` (coachée) : l'e-mail
avec le lien et le code arrive dans Mailpit, http://127.0.0.1:54324.

## Mise en production (Supabase hébergé + Vercel)

1. **Base de données** : `npx supabase link --project-ref <ref>` puis `npx supabase db push`
   (ou coller les fichiers de `supabase/migrations/` dans l'éditeur SQL, dans l'ordre).
2. **Authentication → URL Configuration** : *Site URL* = l'URL Vercel (ex. `https://mon-coaching.vercel.app`).
3. **Authentication → Emails → Magic Link** : sujet « Votre lien de connexion » et corps =
   contenu de `supabase/templates/magic_link.html` (le lien doit pointer vers
   `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email`).
4. **E-mails** : le serveur d'envoi intégré à Supabase est limité à quelques e-mails par heure.
   Configurez un SMTP (Resend, Brevo…) dans *Authentication → Emails → SMTP Settings*.
5. **Vercel** : importer le dépôt et définir les variables de `.env.example`
   (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
   `COACH_EMAIL`, `COACH_NAME`).
6. Se connecter avec l'adresse `COACH_EMAIL` : le profil coach est créé (ou le profil coach
   existant de l'étape 1 lui est rattaché). Ajouter un coaché avec son e-mail, puis
   « Envoyer l'invitation » depuis sa fiche.
