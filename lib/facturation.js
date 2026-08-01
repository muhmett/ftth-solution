import { getDb } from './db';
import { termsFor } from './contracts';
import { TICKET_TYPES, DEFAULT_TERMS } from './constants';

/**
 * Attachement mensuel d'un sous-traitant : les tickets dont Percer a prononcé
 * la recette pendant le mois, valorisés au tarif contractuel, retenue de retard
 * déduite. C'est la base de la facture — d'où le détail ticket par ticket.
 */
export function monthlyStatement(orgId, month) {
  const db = getDb();
  const org = db.prepare('SELECT id, name FROM organizations WHERE id = ?').get(orgId);
  if (!org) return null;

  const rows = db.prepare(`
    SELECT t.id, t.reference, t.type, t.client_name, t.address, t.city,
           t.realized_at, t.deadline, t.validated_at, u.name AS equipe_name
    FROM tickets t
    LEFT JOIN users u ON u.id = t.assigned_to
    WHERE t.org_id = ? AND t.status = 'VALIDE' AND strftime('%Y-%m', t.validated_at) = ?
    ORDER BY t.validated_at, t.reference`).all(orgId, month);

  const termsByType = {};
  for (const type of Object.keys(TICKET_TYPES)) termsByType[type] = termsFor(orgId, type);

  const lines = rows.map((t) => {
    const terms = termsByType[t.type] || DEFAULT_TERMS[t.type];
    const price = terms.unit_price || 0;
    const late = !!(t.realized_at && t.deadline && t.realized_at > t.deadline);
    const penalty = late ? Math.round(price * (terms.penalty_rate || 0)) / 100 : 0;
    return { ...t, unit_price: price, late, penalty, net: Math.round((price - penalty) * 100) / 100 };
  });

  const byType = Object.keys(TICKET_TYPES).map((type) => {
    const l = lines.filter((x) => x.type === type);
    return {
      type,
      count: l.length,
      unit_price: termsByType[type].unit_price || 0,
      brut: round2(l.reduce((s, x) => s + x.unit_price, 0)),
      penalites: round2(l.reduce((s, x) => s + x.penalty, 0)),
      net: round2(l.reduce((s, x) => s + x.net, 0)),
    };
  }).filter((r) => r.count > 0);

  return {
    org,
    month,
    lines,
    byType,
    totals: {
      count: lines.length,
      late: lines.filter((l) => l.late).length,
      brut: round2(lines.reduce((s, x) => s + x.unit_price, 0)),
      penalites: round2(lines.reduce((s, x) => s + x.penalty, 0)),
      net: round2(lines.reduce((s, x) => s + x.net, 0)),
    },
  };
}

// Mois disponibles (ceux où au moins une recette a été prononcée)
export function availableMonths(orgId) {
  const db = getDb();
  const sql = `
    SELECT DISTINCT strftime('%Y-%m', validated_at) AS month
    FROM tickets WHERE status = 'VALIDE' AND validated_at IS NOT NULL
    ${orgId ? 'AND org_id = ?' : ''}
    ORDER BY month DESC LIMIT 24`;
  const rows = orgId ? db.prepare(sql).all(orgId) : db.prepare(sql).all();
  const months = rows.map((r) => r.month).filter(Boolean);
  const current = new Date().toISOString().slice(0, 7);
  return months.includes(current) ? months : [current, ...months];
}

/**
 * Mois affiché par défaut : le dernier mois facturé plutôt que le mois courant,
 * qui est vide en début de période.
 */
export function defaultMonth(orgId) {
  const db = getDb();
  const current = new Date().toISOString().slice(0, 7);
  const sql = `SELECT COUNT(*) AS n FROM tickets
    WHERE status = 'VALIDE' AND strftime('%Y-%m', validated_at) = ?
    ${orgId ? 'AND org_id = ?' : ''}`;
  const stmt = db.prepare(sql);
  const hasCurrent = (orgId ? stmt.get(current, orgId) : stmt.get(current)).n > 0;
  if (hasCurrent) return current;
  return availableMonths(orgId).find((m) => m !== current) || current;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}
