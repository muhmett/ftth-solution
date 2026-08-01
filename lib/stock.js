import { getDb } from './db';

// Effet d'un mouvement sur le dépôt de la société
const DEPOT_SQL = `
  CASE m.kind
    WHEN 'ENTREE' THEN m.quantity
    WHEN 'ATTRIBUTION' THEN -m.quantity
    WHEN 'RETOUR' THEN m.quantity
    WHEN 'PERTE' THEN (CASE WHEN m.equipe_id IS NULL THEN -m.quantity ELSE 0 END)
    WHEN 'AJUSTEMENT' THEN (CASE WHEN m.equipe_id IS NULL THEN m.quantity ELSE 0 END)
    ELSE 0
  END`;

// Effet d'un mouvement sur le véhicule d'une équipe
const EQUIPE_SQL = `
  CASE m.kind
    WHEN 'ATTRIBUTION' THEN m.quantity
    WHEN 'CONSOMMATION' THEN -m.quantity
    WHEN 'RETOUR' THEN -m.quantity
    WHEN 'PERTE' THEN -m.quantity
    WHEN 'AJUSTEMENT' THEN m.quantity
    ELSE 0
  END`;

/**
 * Niveaux de stock d'une société : dépôt et total en véhicules, par référence.
 * Tout est recalculé depuis le journal — aucun compteur mutable à resynchroniser.
 */
export function stockLevels(orgId) {
  return getDb().prepare(`
    SELECT mat.id, mat.reference, mat.label, mat.unit, mat.min_stock, mat.active,
      COALESCE(SUM(${DEPOT_SQL}), 0) AS depot,
      COALESCE(SUM(CASE WHEN m.equipe_id IS NOT NULL THEN ${EQUIPE_SQL} ELSE 0 END), 0) AS equipes,
      COALESCE(SUM(CASE WHEN m.kind = 'CONSOMMATION' THEN m.quantity ELSE 0 END), 0) AS consomme
    FROM materials mat
    LEFT JOIN stock_movements m ON m.material_id = mat.id AND m.org_id = ?
    GROUP BY mat.id
    ORDER BY mat.label`).all(orgId);
}

// Détail par équipe pour une société : ce que chaque véhicule embarque
export function stockByTeam(orgId) {
  return getDb().prepare(`
    SELECT u.id AS equipe_id, u.name AS equipe_name, mat.id AS material_id,
      mat.reference, mat.label, mat.unit,
      COALESCE(SUM(${EQUIPE_SQL}), 0) AS quantity
    FROM users u
    JOIN stock_movements m ON m.equipe_id = u.id
    JOIN materials mat ON mat.id = m.material_id
    WHERE u.org_id = ? AND u.role = 'EQUIPE'
    GROUP BY u.id, mat.id
    HAVING quantity != 0
    ORDER BY u.name, mat.label`).all(orgId);
}

// Stock embarqué par une équipe donnée
export function teamStock(equipeId) {
  return getDb().prepare(`
    SELECT mat.id, mat.reference, mat.label, mat.unit,
      COALESCE(SUM(${EQUIPE_SQL}), 0) AS quantity
    FROM stock_movements m
    JOIN materials mat ON mat.id = m.material_id
    WHERE m.equipe_id = ?
    GROUP BY mat.id
    HAVING quantity != 0
    ORDER BY mat.label`).all(equipeId);
}

// Vue Percer : ce qui a été livré à chaque sous-traitant et ce qu'il en reste
export function consolidatedStock() {
  return getDb().prepare(`
    SELECT o.id AS org_id, o.name AS org_name, mat.id AS material_id,
      mat.reference, mat.label, mat.unit,
      COALESCE(SUM(CASE WHEN m.kind = 'ENTREE' THEN m.quantity ELSE 0 END), 0) AS livre,
      COALESCE(SUM(CASE WHEN m.kind = 'CONSOMMATION' THEN m.quantity ELSE 0 END), 0) AS consomme,
      COALESCE(SUM(CASE WHEN m.kind = 'PERTE' THEN m.quantity ELSE 0 END), 0) AS perdu,
      COALESCE(SUM(${DEPOT_SQL}), 0)
        + COALESCE(SUM(CASE WHEN m.equipe_id IS NOT NULL THEN ${EQUIPE_SQL} ELSE 0 END), 0) AS restant
    FROM organizations o
    JOIN stock_movements m ON m.org_id = o.id
    JOIN materials mat ON mat.id = m.material_id
    WHERE o.type = 'SOUS_TRAITANT'
    GROUP BY o.id, mat.id
    ORDER BY o.name, mat.label`).all();
}

// Références sous le seuil d'alerte, en dépôt comme en véhicule
export function lowStock(orgId) {
  return stockLevels(orgId).filter(
    (s) => s.active && s.min_stock > 0 && s.depot + s.equipes < s.min_stock
  );
}
