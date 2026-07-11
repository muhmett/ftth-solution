# Déploiement du démo public — état d'avancement

Objectif : publier un démo public de la plateforme (lien partageable, comptes
de démonstration du seed) sur l'hébergement Higgsfield.

## État : ✅ DÉPLOYÉ

**Démo en ligne : https://percer-ftth.higgsfield.app**

- Site hébergeur : `website_id = ca204524-2d27-48aa-bc9f-91d981676a00`,
  sous-domaine `percer-ftth` (type `website`).
- Le blocage réseau vers `apps-repos.higgsfield.ai` est levé — le code a été
  poussé et le build CI de l'hébergeur a déployé le site.

### Comptes de démonstration (seedés via migration D1)

| Rôle         | Téléphone   | Mot de passe |
|--------------|-------------|--------------|
| Admin        | 0600000000  | admin123     |
| Coordinateur | 0611111111  | coord123     |
| Technicien   | 0622222222  | tech123      |
| Technicien   | 0633333333  | tech123      |

5 tickets de démonstration (FTTH, Partage In/Out, SAV) sont seedés.

## Ce qui a été porté (stack hébergeur)

L'application a été portée de Next.js 14 / better-sqlite3 vers la stack de
l'hébergeur : **React 19 + TanStack Start, un seul Worker Cloudflare**.

- **D1** à la place de better-sqlite3 — même schéma, migration idempotente
  (`app/migrations/0001_init.sql`) avec le seed des comptes/tickets démo.
- **R2** pour les photos de preuve (upload multipart, service authentifié
  via `/api/photos/*`).
- **JWT via WebCrypto** (HMAC-SHA256, cookie httpOnly `percer_session`) —
  pas de `jsonwebtoken` ; secret `JWT_SECRET` configuré côté hébergeur.
- **PBKDF2-SHA256 (WebCrypto, 100k itérations)** pour les mots de passe —
  pas de bcrypt.
- **xlsx** fonctionne tel quel dans le Worker (import Excel préservé :
  auto-détection des colonnes, preview/commit, doublons ignorés).
- Règles métier de `lib/constants.js` reprises à l'identique ; écrans
  `app/` (admin + technicien) et motif fibre (`FiberBackground`) portés
  tels quels en Tailwind v4 (marque Percer orange `#ff7900`).

### Vérifications effectuées (post-déploiement)

- Login des 4 comptes démo OK ; mauvais mot de passe → 401.
- Un technicien ne voit que ses tickets ; API protégées → 401 sans session.
- Dashboard coordination (stats/compteurs) OK avec les données seedées.

## Limite connue

La **cover du feed Higgsfield** a été composée par programme (Pillow) au lieu
d'une génération IA : le compte n'a pas de plan payant (`generate_image` →
« Requires basic plan or higher »). Métadonnées (`app/src/app-meta.json`)
remplies : titre, description, favicon, OG image, cover marketplace.
Le site est déployé mais **pas publié sur le feed communautaire** (sur demande).

## Reprendre la main sur le code hébergé

1. `mcp__higgs__website_repo_access(website_id ci-dessus)` → clone du dépôt
   de l'hébergeur (branche `main`, projet dans `app/`).
2. Éditer, `git push`, puis `mcp__higgs__deploy_website` pour livrer.
