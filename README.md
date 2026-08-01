# Percer — Plateforme de gestion des interventions FTTH

Plateforme web multi-société pour la chaîne de sous-traitance fibre optique au Maroc :
**Orange → Percer (donneur d'ordre) → sous-traitants → équipes terrain**.
Couvre les tickets **FTTH (production)**, **Partage In**, **Partage Out** et **SAV (dérangement)**.

## Le problème résolu

Aujourd'hui les tickets circulent en fichiers Excel et les preuves d'intervention par WhatsApp :
personne ne sait en temps réel où en est un ticket, les blocages disparaissent, et la facturation
de fin de mois se discute sans preuves. La plateforme remplace cet échange par un circuit tracé
de bout en bout, où chaque société ne voit que son propre périmètre.

## Chaîne de traitement

```
Percer importe le fichier opérateur
        ↓  répartition d'un lot
Sous-traitant (Ayline, Sotra Fibre, …)
        ↓  affectation
Équipe terrain (1 compte = binôme de 2 intervenants)
        ↓  photos + mesure photomètre obligatoires
Contrôle qualité du sous-traitant
        ↓
Recette Percer  →  ticket facturable
```

Statuts : `NOUVEAU → DISPATCHE → AFFECTE → EN_COURS → REALISE → VALIDE_ST → VALIDE`,
plus `BLOQUE` (avec motif normalisé) et `ANNULE`. Un rejet à l'un des deux niveaux de
contrôle renvoie le ticket à l'équipe. Chaque transition est horodatée dans l'historique.

## Cloisonnement des sociétés

C'est la contrainte structurante : deux sous-traitants concurrents travaillent sur la même
plateforme sans jamais voir les clients de l'autre.

| Rôle | Périmètre visible |
|---|---|
| `PERCER_ADMIN` / `PERCER_COORD` | Tous les sous-traitants |
| `ST_COORD` | Uniquement sa société |
| `EQUIPE` | Uniquement les tickets qui lui sont affectés |

La portée est appliquée côté serveur (`ticketScope` / `assertTicketAccess` dans `lib/auth.js`)
sur **toutes** les lectures, y compris le téléchargement des photos — jamais dans l'interface seule.

## Fonctionnalités

### Percer (donneur d'ordre)
- **Import Excel** du fichier opérateur, détection automatique des colonnes et du type d'activité.
- **Répartition** : constitution de lots par zone ou activité, envoi en masse à un sous-traitant.
- **Recette** : validation ou rejet des tickets déjà contrôlés, seule étape qui rend un ticket facturable.
- **Contrats** : prix unitaire, délai accordé et retenue de retard, par sous-traitant et par activité.
- **Attachement mensuel** : décompte des recettes du mois valorisées au tarif contractuel, retenues
  déduites, exportable en Excel (récapitulatif + détail ticket par ticket).
- **Pilotage** : vue consolidée par sous-traitant, taux de respect des délais, alertes sur les
  échéances dépassées et sur les blocages de plus de 24 h.
- **Sous-traitants** : création et activation des sociétés partenaires.

### Sous-traitant
- Reçoit ses lots automatiquement, sans échange de fichier.
- **Affectation** aux équipes, en masse ou ticket par ticket, avec la charge en cours de chacune.
- **Contrôle qualité interne** avant transmission à Percer.
- **Attachement en miroir** : le même décompte que celui de Percer, en lecture seule — les écarts
  se constatent en cours de mois, plus au moment de la facture.
- **Conditions contractuelles** consultables (prix, délais, retenues).
- **Équipes** : un compte par binôme, avec le nom des deux intervenants pour la traçabilité.
- Import Excel disponible en repli si Percer n'est pas encore sur la plateforme.

### Équipe terrain (mobile / PWA)
- Liste de ses tickets, appel client et itinéraire en un geste.
- **Clôture conditionnée par les preuves** :
  - FTTH & Partage In : PTO + mesure photomètre + routeur/ONT en service
  - Partage Out : PTO + mesure photomètre
  - SAV : photo avant + photo après
  - Mesure optique obligatoire, cohérence contrôlée (−30 à −8 dB)
- **Déclaration de blocage** avec motif normalisé — le ticket remonte immédiatement à la
  coordination pour replanification au lieu de rester en attente.
- **Notifications sur le téléphone** à l'affectation d'un ticket, au rejet et à la replanification.
- Échéance et état du délai visibles sur chaque ticket.
- Prise de photo directe par la caméra, installable sur Android.

## Délais et facturation

L'échéance d'un ticket est le **rendez-vous client** quand il est fixé, sinon la date de
répartition augmentée du **délai contractuel** de l'activité. Elle est recalculée à chaque
répartition, replanification ou changement de contrat. Un ticket réalisé après son échéance est
marqué hors délai et subit la retenue prévue au contrat.

L'attachement du mois retient les tickets dont **Percer a prononcé la recette** pendant ce mois :
c'est la seule étape qui rend une intervention facturable. Comme les photos, les mesures et
l'horodatage de chaque transition sont conservés, une ligne contestée se tranche sur pièces.

## Stack technique

- **Next.js 14** (App Router), React 18, JavaScript
- **SQLite** (better-sqlite3) — fichier `data/percer.db`, migration v1→v2 automatique
- **Tailwind CSS**, interface responsive (desktop coordination + mobile terrain)
- Auth **JWT en cookie httpOnly**, mots de passe bcrypt
- **SheetJS (xlsx)** pour l'import
- Photos sur disque (`data/uploads/`), servies uniquement dans le périmètre du ticket

## Démarrage

```bash
npm install
npm run seed     # sociétés, comptes et tickets de démonstration
npm run dev      # http://localhost:3000
# production :
npm run build && npm start
```

### Comptes de démonstration

| Société | Rôle | Téléphone | Mot de passe |
|---|---|---|---|
| Percer | Administrateur | 0600000000 | admin123 |
| Percer | Coordinateur | 0611111111 | coord123 |
| Ayline | Coordinateur | 0622222222 | coord123 |
| Ayline | Équipe 1 — Maârif | 0630000001 | equipe123 |
| Ayline | Équipe 2 — Sidi Maârouf | 0630000002 | equipe123 |
| Ayline | Équipe 3 — Aïn Sebaâ | 0630000003 | equipe123 |
| Sotra Fibre | Coordinateur | 0644444444 | coord123 |
| Sotra Fibre | Équipe 1 — Agdal | 0640000001 | equipe123 |

> ⚠️ En production : définir `JWT_SECRET` et changer tous les mots de passe.

## Vers l'application Android

L'interface terrain est mobile-first et l'application est une **PWA** : elle s'installe déjà
depuis Chrome (« Ajouter à l'écran d'accueil »). Pour le Play Store, deux voies : **TWA**
(empaquetage de la PWA) ou **Capacitor** (ajout de natif : notifications push, GPS).

## Structure

```
app/
  api/            # auth, tickets, dispatch, import, photos, users, organisations,
                  # stats, contrats, facturation (+ export), push
  admin/          # coordination : dashboard, tickets, répartition, facturation,
                  # contrats, sous-traitants, équipes
  tech/           # interface équipe terrain (mobile)
components/       # AdminShell, TechShell, Badges, FiberBackground, UserContext, PushToggle
lib/              # schema.mjs (SQL), db.js (accès + migration), auth.js (portées),
                  # contracts.js (échéances), facturation.js (attachement), push.js, constants.js
public/sw.js      # service worker des notifications
scripts/seed.mjs  # sociétés, comptes, contrats et tickets de démonstration
```

### Notifications

Les clés VAPID sont générées au premier appel et conservées en base : aucune configuration n'est
requise pour le développement. En production, définir `PUSH_SUBJECT` (adresse de contact) et
servir l'application en HTTPS — le navigateur refuse les notifications autrement.

## Suite envisagée

Gestion du matériel (PTO, routeurs, câble) consommé par équipe, export au format attendu par
l'opérateur, et application Android empaquetée.
