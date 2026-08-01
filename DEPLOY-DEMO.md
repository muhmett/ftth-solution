# Mettre à jour le déploiement Higgsfield

## Situation

Un déploiement existe déjà : **https://ayline-ftth.higgsfield.app**

Il ne s'agit pas d'une copie de ce dépôt mais d'un **portage** réalisé dans une
autre session : l'hébergeur impose sa propre stack (React 19 + TanStack Start,
un Worker Cloudflare, D1, R2), donc le code a été réécrit, avec sa propre
identité visuelle. Conséquence importante : **`git pull` sur ce dépôt ne met pas
ce site à jour**. Les deux bases de code évoluent séparément.

Le portage a été fait à partir de l'état v1 du projet (société unique). Il porte
donc encore les rôles `ADMIN` / `COORDINATEUR` / `TECHNICIEN`, et le compte
administrateur y affecte directement les tickets aux techniciens — comportement
supprimé depuis.

> ⚠️ **Ce site contient des données réelles** (clients, numéros de téléphone,
> techniciens, tickets de production). Toute reprise doit conserver ces données :
> pas de re-seed, pas de `DROP`, pas de redéploiement qui reparte d'une base vide.
> Exporter d'abord (écrans d'export Excel) et conserver la sauvegarde.

## Écart à combler

L'application de ce dépôt a évolué en trois volets, tous absents du site déployé :

| Volet | Contenu |
|---|---|
| Multi-société | Sociétés (donneur d'ordre / sous-traitants), rôles `PERCER_ADMIN`, `PERCER_COORD`, `ST_COORD`, `EQUIPE`, cloisonnement de toutes les lectures, répartition de lots, double validation (contrôle ST puis recette Percer) |
| Contrats & délais | Tarifs et délais par sous-traitant et activité, échéance calculée, taux de respect, attachement mensuel et export, notifications push |
| Stock & exports | Catalogue matériel, journal des mouvements, dotation véhicule, consommation à la clôture, export des tickets |

S'y ajoute la règle demandée ensuite : **le donneur d'ordre ne voit ni les
équipes ni les intervenants d'un sous-traitant**, et ne peut pas leur affecter
de ticket (`hideTeamIdentity` / `stripTeamFields` dans `lib/auth.js`).

## Reprendre le portage (session avec réseau ouvert)

Le réseau de la session doit autoriser `higgsfield.app` et
`apps-repos.higgsfield.ai` (environnement en accès **Full**).

1. Retrouver le site : `mcp__higgs__list_websites`, repérer `ayline-ftth`.
2. `mcp__higgs__get_website_creation_instructions`, puis
   `website_repo_access(<website_id>)` pour cloner son dépôt.
3. **Avant toute modification**, inspecter la base avec `mcp__higgs__website_db`
   (`tables`, puis `rows`) et sauvegarder ce qui existe.
4. Porter l'écart ci-dessus. Références dans ce dépôt :
   - `lib/schema.mjs` — schéma complet (sociétés, contrats, stock, push)
   - `lib/auth.js` — **les portées de lecture ; à reporter à l'identique**
   - `lib/constants.js` — rôles, statuts, motifs de blocage, photos exigées
   - `lib/contracts.js`, `lib/facturation.js`, `lib/stock.js` — règles de calcul
   - `app/` — écrans, réutilisables tels quels (Tailwind)
   - Adaptations de stack : D1 au lieu de better-sqlite3, R2 pour les photos,
     JWT et hachage via WebCrypto (ni `jsonwebtoken` ni `bcrypt`) ; `xlsx`
     fonctionne dans le Worker.
5. **Migrer les données existantes plutôt que les recréer** : rattacher les
   comptes et tickets actuels à une société, convertir les rôles
   (`ADMIN`→`PERCER_ADMIN`, `COORDINATEUR`→`PERCER_COORD`, `TECHNICIEN`→`EQUIPE`).
   `upgradeToMultiOrg` dans `lib/db.js` décrit la correspondance appliquée ici.
6. `deploy_website`, puis vérifier sur `/api/version` que le build attendu répond.

## Vérifier quelle version tourne

Chaque build de ce dépôt expose son empreinte :

- en bas du menu de coordination : `build <commit> · <date>` ;
- sur `/api/version` : commit, date et fonctionnalités présentes.

Un `404` sur `/api/version` signifie que le serveur consulté est antérieur à
cette mise en place — donc pas à jour.
