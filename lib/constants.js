// Domaine métier FTTH — Percer (partenaire Orange Maroc)

export const TICKET_TYPES = {
  FTTH: { label: 'FTTH (Production)', short: 'FTTH', color: 'bg-orange-100 text-orange-800' },
  PARTAGE_IN: { label: 'Partage In', short: 'P-IN', color: 'bg-blue-100 text-blue-800' },
  PARTAGE_OUT: { label: 'Partage Out', short: 'P-OUT', color: 'bg-purple-100 text-purple-800' },
  SAV: { label: 'SAV (Dérangement)', short: 'SAV', color: 'bg-red-100 text-red-800' },
};

export const TICKET_STATUS = {
  NOUVEAU: { label: 'Nouveau', color: 'bg-gray-100 text-gray-800' },
  AFFECTE: { label: 'Affecté', color: 'bg-sky-100 text-sky-800' },
  EN_COURS: { label: 'En cours', color: 'bg-amber-100 text-amber-800' },
  REALISE: { label: 'Réalisé (à valider)', color: 'bg-lime-100 text-lime-800' },
  VALIDE: { label: 'Validé', color: 'bg-green-100 text-green-800' },
  BLOQUE: { label: 'Bloqué', color: 'bg-red-100 text-red-800' },
  ANNULE: { label: 'Annulé', color: 'bg-gray-200 text-gray-500' },
};

// Motifs de blocage standards (production + SAV)
export const BLOCKAGE_REASONS = {
  CLIENT_ABSENT: 'Client absent au RDV',
  CLIENT_INJOIGNABLE: 'Client injoignable',
  REFUS_CLIENT: 'Refus client',
  ADRESSE_INTROUVABLE: 'Adresse introuvable / erronée',
  PBO_SATURE: 'PBO saturé',
  PBO_INTROUVABLE: 'PBO introuvable',
  PAS_DE_CONTINUITE: 'Pas de continuité optique',
  IMMEUBLE_NON_RACCORDE: 'Immeuble non raccordé / pas de colonne montante',
  SYNDIC_REFUS: 'Refus syndic / accès immeuble',
  PROBLEME_PERMISSION: 'Problème autorisation (voirie, façade...)',
  MATERIEL_MANQUANT: 'Matériel manquant (routeur, câble...)',
  AUTRE: 'Autre motif',
};

// Types de photos exigées pour la validation
export const PHOTO_TYPES = {
  PTO: 'PTO installée',
  PHOTOMETRE: 'Mesure photomètre (dB)',
  ROUTEUR: 'Routeur / ONT en service',
  PBO: 'PBO / soudure',
  FACADE: 'Façade / cheminement câble',
  AVANT: 'Avant intervention (SAV)',
  APRES: 'Après intervention (SAV)',
  AUTRE: 'Autre',
};

// Photos minimales exigées par type de ticket pour clôturer
export const REQUIRED_PHOTOS = {
  FTTH: ['PTO', 'PHOTOMETRE', 'ROUTEUR'],
  PARTAGE_IN: ['PTO', 'PHOTOMETRE', 'ROUTEUR'],
  PARTAGE_OUT: ['PTO', 'PHOTOMETRE'],
  SAV: ['AVANT', 'APRES'],
};

export const ROLES = {
  ADMIN: 'Administrateur',
  COORDINATEUR: 'Coordinateur',
  TECHNICIEN: 'Technicien',
};

// Seuil d'alerte pour tickets bloqués (heures)
export const BLOCKED_ALERT_HOURS = 24;
