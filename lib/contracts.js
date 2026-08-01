import { getDb } from './db';
import { DEFAULT_TERMS } from './constants';

/**
 * Échéance d'un ticket : le rendez-vous client quand il est fixé, sinon la date
 * de répartition augmentée du délai contractuel. Recalculée à chaque
 * répartition et à chaque replanification.
 */
export const DEADLINE_SQL = `
  COALESCE(
    datetime(NULLIF(rdv_date, '')),
    datetime(COALESCE(dispatched_at, created_at), '+' || ? || ' hours')
  )`;

/**
 * État du délai, dérivé en SQL pour que l'affichage et les filtres s'accordent.
 * `alias` est le préfixe de la table tickets dans la requête appelante.
 */
export const slaSql = (alias = 't') => `
  CASE
    WHEN ${alias}.deadline IS NULL OR ${alias}.status = 'ANNULE' THEN 'SANS_DELAI'
    WHEN ${alias}.realized_at IS NOT NULL THEN
      CASE WHEN ${alias}.realized_at <= ${alias}.deadline THEN 'RESPECTE' ELSE 'DEPASSE' END
    WHEN datetime('now') > ${alias}.deadline THEN 'EN_RETARD'
    WHEN datetime('now', '+24 hours') > ${alias}.deadline THEN 'A_RISQUE'
    ELSE 'A_LHEURE'
  END`;

// Conditions contractuelles applicables, complétées par les valeurs par défaut
export function termsFor(orgId, ticketType) {
  const row = orgId
    ? getDb().prepare('SELECT * FROM contract_terms WHERE org_id = ? AND ticket_type = ?')
        .get(orgId, ticketType)
    : null;
  return row || { ...DEFAULT_TERMS[ticketType], org_id: orgId, ticket_type: ticketType };
}

// Recalcule et enregistre l'échéance d'un ticket
export function refreshDeadline(ticketId) {
  const db = getDb();
  const ticket = db.prepare('SELECT id, org_id, type FROM tickets WHERE id = ?').get(ticketId);
  if (!ticket) return;
  const { sla_hours } = termsFor(ticket.org_id, ticket.type);
  db.prepare(`UPDATE tickets SET deadline = ${DEADLINE_SQL} WHERE id = ?`).run(sla_hours, ticketId);
}

// Montant facturable d'un ticket validé, retenue de retard déduite
export function ticketAmount(ticket, terms) {
  const price = terms.unit_price || 0;
  const late = ticket.realized_at && ticket.deadline && ticket.realized_at > ticket.deadline;
  const penalty = late ? Math.round(price * (terms.penalty_rate || 0)) / 100 : 0;
  return { price, penalty, net: Math.round((price - penalty) * 100) / 100, late: !!late };
}
