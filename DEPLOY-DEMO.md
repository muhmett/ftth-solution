# Ayline — Plateforme FTTH — état de déploiement

Plateforme de gestion des interventions fibre optique (FTTH, Partage In/Out,
SAV), déployée en ligne sur l'hébergement Higgsfield.

## État : ✅ EN LIGNE

**Application : https://ayline-ftth.higgsfield.app**

- Site hébergeur : `website_id = ca204524-2d27-48aa-bc9f-91d981676a00`,
  sous-domaine `ayline-ftth` (anciennement `percer-ftth`).
- Stack : React 19 + TanStack Start, un seul Worker Cloudflare (D1 + R2),
  auth JWT WebCrypto (cookie httpOnly) + mots de passe PBKDF2-SHA256.

### Comptes

| Rôle | Téléphone | Mot de passe |
|---|---|---|
| Admin | 0600000000 | admin123 |
| Coordinateur | 0611111111 | coord123 |
| Techniciens Fès | 0661000001…04 | ayline123 | (Dahbi, Mourad, Redouan, Bazout) |
| Techniciens Meknès | 0661000005…08 | ayline123 | (Rachid, Driss, Tarik, Ayoub) |

> Ancien seed de démo (Casablanca) toujours présent : techniciens
> 0622222222 / 0633333333 (tech123).

### Rôles

- **Coordinateur** : tout le tournant quotidien — import Excel, création/**édition**
  de tickets, affectation (unitaire + masse), validation/rejet/replanification,
  contrôle qualité photo, rapports d'activité, export Excel, impression.
- **Admin** : idem coordinateur **+** gestion des comptes (création, rôles,
  mots de passe, activation/désactivation).

## Fonctionnalités adaptées au fichier opérateur réel

- **Import Excel réel** : détection automatique des colonnes du fichier reçu
  (`Date`, `Adresse d'installation`, `SIP`→ND, `ID`→référence, `CIN Client`,
  `Nom du client`, `Contact Client`, `Offre`, `portabilite`). La colonne
  **`Feed-back` du fichier n'est jamais importée** (le feedback appartient au
  technicien dans l'app).
- **Code MapSurvey Orange** : extrait automatiquement de l'adresse (motif
  `CODE 14.6.21.132`) et stocké sur le ticket. Bouton « Copier + MapSurvey »
  côté technicien et coordination (copie le code et ouvre mapsurvey.orange.ma).
- **Auto-affectation** : si le fichier contient une colonne technicien, le
  ticket est affecté automatiquement au technicien correspondant (par nom).
- **Normalisation** : téléphone (`690…`→`0690…`), dates.
- **Anti-doublon** : une référence déjà en cours est ignorée (testé : 7 doublons
  sautés à la ré-importation).

## Flux terrain (technicien)

- **Feedback RDV** (obligatoire dans le flux manuel) : après l'appel du client,
  le technicien note le résultat (RDV pris, injoignable, boîte vocale…) + un
  nouveau RDV. Le coordinateur le voit immédiatement (💬 dans la liste).
- **Position GPS exacte** : bouton « Enregistrer ma position ici » sur le point
  d'installation → « Ouvrir dans Maps » pointe sur les coordonnées, pas l'adresse
  contrat (souvent fausse). Utile surtout au SAV.
- Photos de preuve (R2), mesure photomètre dB (plage −30/−8), blocage motivé.
- Onglet « Mon activité » (validés / réalisés / en cours / bloqués / feedbacks
  par période).

## Coordination

- **Édition d'un ticket** : formulaire « Modifier » (corrige les données Excel
  erronées : client, adresse, CIN, code MapSurvey, RDV…).
- **Activité par technicien** : `/admin/equipe/:id` — compteurs par période,
  cadence par jour, liste des tickets, **impression** du rapport.
- **Export Excel** des tickets (mêmes filtres que la liste) pour renvoi à
  l'opérateur.
- **Impression** de la fiche ticket (masque nav/décor).

## Limite connue

Cover du feed composée par programme (Pillow), pas par génération IA (compte
sans plan payant Higgsfield). Métadonnées (`app/src/app-meta.json`) remplies.
Site déployé mais **non publié sur le feed communautaire** (sur demande).

## Reprendre la main sur le code hébergé

1. `mcp__higgs__website_repo_access(website_id ci-dessus)` → clone du dépôt
   (branche `main`, projet dans `app/`).
2. Éditer, `git push`, puis `mcp__higgs__deploy_website` pour livrer.
