# Percer — Plateforme de gestion des interventions FTTH

Plateforme web pour **Percer**, entreprise sous-traitante fibre optique (partenaire Orange Maroc).
Gère le cycle de vie complet des tickets d'intervention : **FTTH (production)**, **Partage In**,
**Partage Out** et **SAV (dérangement)**.

## Fonctionnalités

### Coordination / Administration (desktop)
- **Tableau de bord** : compteurs par statut, tickets réalisés en attente de validation,
  charge et performance par technicien, **alertes sur les tickets bloqués depuis plus de 24h**.
- **Import Excel** : chargement du fichier reçu de l'opérateur (.xlsx/.xls/.csv),
  détection automatique des colonnes (référence, client, téléphone, adresse, PBO, RDV…),
  mapping ajustable avec aperçu, détection automatique du type d'activité
  (FTTH / Partage In / Partage Out / SAV), doublons ignorés.
- **Affectation** : distribution des tickets aux techniciens (unitaire ou en masse),
  avec visibilité de la charge en cours de chaque technicien.
- **Contrôle qualité** : consultation des photos de preuve, validation ou rejet
  (retour au technicien) des tickets réalisés, replanification des tickets bloqués.
- **Équipe** : gestion des comptes (admin, coordinateur, technicien), zones, activation/désactivation.

### Technicien (mobile / PWA)
- Liste de **ses** tickets : à faire / bloqués / terminés, avec appel client et
  ouverture de l'adresse dans Google Maps en un clic.
- Démarrage d'intervention, puis **clôture conditionnée par les preuves** :
  - Photos obligatoires selon l'activité :
    - FTTH & Partage In : PTO installée + mesure photomètre + routeur/ONT en service
    - Partage Out : PTO + mesure photomètre
    - SAV : photo avant + photo après
  - Mesure photomètre en dB obligatoire (plage de cohérence contrôlée : −30 à −8 dB)
  - S/N du routeur/ONT
- **Déclaration de blocage** avec motif normalisé (client absent, PBO saturé, refus client,
  adresse introuvable, pas de continuité optique…) + commentaire. Le ticket remonte
  immédiatement chez le coordinateur pour replanification — il ne reste jamais en attente.
- Prise de photo directe caméra (`capture=environment`), installable sur Android (PWA).

### Workflow d'un ticket

```
NOUVEAU → AFFECTE → EN_COURS → REALISE → VALIDE
             ↑          ↓  (photos + dB exigés)   ↑
             └─── BLOQUE (motif) ── replanifié    └── REJET → retour AFFECTE
```

Chaque action est tracée dans l'historique du ticket (qui, quoi, quand).

## Stack technique

- **Next.js 14** (App Router) — React 18, JavaScript
- **SQLite** (better-sqlite3) — zéro configuration, fichier `data/percer.db`
- **Tailwind CSS** — UI responsive (desktop admin + mobile technicien)
- Auth **JWT en cookie httpOnly** (bcrypt pour les mots de passe), rôles ADMIN / COORDINATEUR / TECHNICIEN
- **SheetJS (xlsx)** pour l'import Excel
- Photos stockées sur disque (`data/uploads/`), servies uniquement aux utilisateurs authentifiés

## Démarrage

```bash
npm install
npm run seed     # crée la base + comptes de démonstration
npm run dev      # développement (http://localhost:3000)
# ou en production :
npm run build && npm start
```

### Comptes de démonstration

| Rôle         | Téléphone   | Mot de passe |
|--------------|-------------|--------------|
| Admin        | 0600000000  | admin123     |
| Coordinateur | 0611111111  | coord123     |
| Technicien   | 0622222222  | tech123      |
| Technicien   | 0633333333  | tech123      |

> ⚠️ En production : définir `JWT_SECRET` dans l'environnement et changer les mots de passe.

## Vers l'application Android

L'interface technicien est **mobile-first** et l'app est une **PWA** (manifest inclus) :
elle s'installe déjà sur Android depuis Chrome (« Ajouter à l'écran d'accueil »).
Pour une app Play Store, deux voies :
1. **TWA (Trusted Web Activity)** — empaqueter la PWA telle quelle ;
2. **Capacitor** — encapsuler le front et ajouter du natif (notifications push FCM, GPS…).

## Structure

```
app/
  api/            # REST : auth, tickets, import, photos, users, stats
  admin/          # interface coordination (dashboard, tickets, import, équipe)
  tech/           # interface technicien (mobile)
  login/
components/       # AdminShell, TechShell, Badges
lib/              # db.js (schéma SQLite), auth.js (JWT), constants.js (métier)
scripts/seed.js   # initialisation + données de démo
```
