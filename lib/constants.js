// Domaine métier FTTH — chaîne Orange → Percer (donneur d'ordre) → sous-traitants → équipes

export const ORG_TYPES = {
  DONNEUR_ORDRE: "Donneur d'ordre",
  SOUS_TRAITANT: 'Sous-traitant',
};

export const TICKET_TYPES = {
  FTTH: { label: 'FTTH (Production)', short: 'FTTH', color: 'bg-orange-100 text-orange-800' },
  PARTAGE_IN: { label: 'Partage In', short: 'P-IN', color: 'bg-blue-100 text-blue-800' },
  PARTAGE_OUT: { label: 'Partage Out', short: 'P-OUT', color: 'bg-purple-100 text-purple-800' },
  SAV: { label: 'SAV (Dérangement)', short: 'SAV', color: 'bg-red-100 text-red-800' },
};

// Cycle de vie : Percer importe → répartit vers un sous-traitant → le sous-traitant
// affecte à une équipe → l'équipe réalise → contrôle ST → recette Percer.
export const TICKET_STATUS = {
  NOUVEAU: { label: 'Nouveau', color: 'bg-gray-100 text-gray-800' },
  DISPATCHE: { label: 'Réparti', color: 'bg-indigo-100 text-indigo-800' },
  AFFECTE: { label: 'Affecté', color: 'bg-sky-100 text-sky-800' },
  EN_COURS: { label: 'En cours', color: 'bg-amber-100 text-amber-800' },
  REALISE: { label: 'Réalisé (à contrôler)', color: 'bg-lime-100 text-lime-800' },
  VALIDE_ST: { label: 'Contrôlé ST', color: 'bg-teal-100 text-teal-800' },
  VALIDE: { label: 'Validé Percer', color: 'bg-green-100 text-green-800' },
  BLOQUE: { label: 'Bloqué', color: 'bg-red-100 text-red-800' },
  ANNULE: { label: 'Annulé', color: 'bg-gray-200 text-gray-500' },
};

export const ROLES = {
  PERCER_ADMIN: 'Administrateur Percer',
  PERCER_COORD: 'Coordinateur Percer',
  ST_COORD: 'Coordinateur sous-traitant',
  EQUIPE: 'Équipe terrain',
};

// Rôles côté donneur d'ordre : visibilité sur tous les sous-traitants
export const PERCER_ROLES = ['PERCER_ADMIN', 'PERCER_COORD'];
// Rôles de pilotage (par opposition aux équipes terrain)
export const COORD_ROLES = ['PERCER_ADMIN', 'PERCER_COORD', 'ST_COORD'];

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

// Seuil d'alerte pour tickets bloqués (heures)
export const BLOCKED_ALERT_HOURS = 24;

// Respect du délai contractuel. Les trois premiers états concernent les tickets
// encore ouverts, les deux suivants ceux dont l'intervention est faite.
export const SLA_STATES = {
  A_LHEURE: { label: 'Dans les délais', short: 'À l\'heure', color: 'bg-green-100 text-green-800' },
  A_RISQUE: { label: 'Échéance sous 24h', short: 'À risque', color: 'bg-amber-100 text-amber-800' },
  EN_RETARD: { label: 'Délai dépassé', short: 'En retard', color: 'bg-red-100 text-red-800' },
  RESPECTE: { label: 'Délai respecté', short: 'Respecté', color: 'bg-green-100 text-green-800' },
  DEPASSE: { label: 'Réalisé hors délai', short: 'Hors délai', color: 'bg-orange-100 text-orange-800' },
  SANS_DELAI: { label: 'Sans échéance', short: '—', color: 'bg-gray-100 text-gray-500' },
};

// Conditions appliquées à un sous-traitant tant qu'aucun contrat n'est saisi
export const DEFAULT_TERMS = {
  FTTH: { unit_price: 0, sla_hours: 72, penalty_rate: 0 },
  PARTAGE_IN: { unit_price: 0, sla_hours: 72, penalty_rate: 0 },
  PARTAGE_OUT: { unit_price: 0, sla_hours: 72, penalty_rate: 0 },
  SAV: { unit_price: 0, sla_hours: 24, penalty_rate: 0 },
};

export const CURRENCY = 'MAD';
