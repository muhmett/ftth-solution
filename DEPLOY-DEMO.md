# Déploiement du démo public — état d'avancement

Objectif : publier un démo public de la plateforme (lien partageable, comptes
de démonstration du seed) sur l'hébergement Higgsfield.

## État

- Site créé côté hébergeur : `website_id = ca204524-2d27-48aa-bc9f-91d981676a00`,
  sous-domaine `percer-ftth` (type `website`).
- **Bloqué** : la politique réseau de la session Claude Code n'autorisait pas
  `apps-repos.higgsfield.ai` (403 du proxy sortant) — impossible de pousser le
  code vers le dépôt de l'hébergeur.

## Reprendre le déploiement (session avec réseau ouvert)

1. `mcp__higgs__get_website_creation_instructions` puis
   `website_repo_access(website_id ci-dessus)` pour cloner le dépôt du site.
2. Porter l'application sur la stack de l'hébergeur : React 19 + TanStack Start,
   un seul Worker Cloudflare — D1 à la place de better-sqlite3, R2 pour les
   photos, JWT via WebCrypto (pas de `jsonwebtoken`), hash PBKDF2/WebCrypto
   (pas de bcrypt), `xlsx` fonctionne dans le Worker. Reprendre le schéma
   (`lib/schema.mjs`), les règles métier (`lib/constants.js`) et **surtout les
   portées de `lib/auth.js`** : le cloisonnement entre sous-traitants doit être
   reporté à l'identique sur chaque requête. Les écrans `app/` se reprennent
   tels quels (Tailwind), motif fibre inclus (`components/FiberBackground.jsx`).
3. Seeder les sociétés et comptes de démonstration (voir README) via migration D1.
4. Cover + métadonnées (`app/src/app-meta.json`) puis `deploy_website`.
