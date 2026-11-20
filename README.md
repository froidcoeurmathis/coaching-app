# Coaching sportif — Hyrox · Course · Muscu

Application de coaching : le coach gère ses coachés et programme leurs séances dans un
calendrier hebdomadaire ; chaque coaché se connecte et voit uniquement ses séances.
Voir `CLAUDE.md` pour le modèle de données, la sécurité et la feuille de route.

## Démarrer en local

Prérequis : Node 20+, Docker (pour Supabase local).

```bash
npm install
npx supabase start          # Postgres, Auth, API ; applique migrations + données de démo (programme de Clara)
cp .env.example .env.local  # renseigner les valeurs affichées par `npx supabase status`, et COACH_EMAIL=coach@example.com
npm run dev                 # http://localhost:3000
```

Comptes de démo : `coach@example.com` / `coach1234` (coach) et `clara@example.com` / `clara1234` (coachée).

## Mise en production (Supabase hébergé + Vercel)

1. **Base de données** : `npx supabase link --project-ref <ref>` puis `npx supabase db push`
   (ou coller les fichiers de `supabase/migrations/` dans l'éditeur SQL, dans l'ordre).
2. **Vercel** : importer le dépôt et définir les variables de `.env.example`
   (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
   `COACH_EMAIL`, `COACH_NAME`).
3. **Mot de passe du coach** : en local, avec les variables du projet hébergé dans `.env.local`
   (ou dans l'environnement) :
   ```bash
   npm run set-password -- votre@email.com "votre-mot-de-passe"
   ```
   puis se connecter sur `/login` avec l'adresse `COACH_EMAIL` : le profil coach est créé.
4. **Programme de Clara** : coller `supabase/data/clara.sql` dans l'éditeur SQL de Supabase et
   l'exécuter (crée sa fiche, ses allures et ses 72 séances ; sans effet s'il a déjà été importé).
5. **Accès d'un coaché** : sur sa fiche, renseigner son e-mail puis « Créer l'accès » ; choisir ou
   générer un mot de passe et le lui transmettre. Il pourra le changer dans « Mon compte ».
   En cas d'oubli : « Réinitialiser le mot de passe » sur sa fiche.

Aucun e-mail n'est envoyé par l'application : pas de serveur d'envoi à configurer.

## Installer l'appli sur téléphone (coachés)

- **iPhone** : ouvrir le site dans Safari → *Partager* → *Sur l'écran d'accueil*, puis se
  reconnecter une fois dans l'appli installée.
- **Android** : un bouton « Installer » apparaît sur la page « Mes séances » (ou menu Chrome →
  *Installer l'application*).
