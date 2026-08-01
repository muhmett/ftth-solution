import { getDb } from '@/lib/db';
import { requireUser, apiHandler, ticketScope, isPercer } from '@/lib/auth';
import { BLOCKED_ALERT_HOURS, COORD_ROLES } from '@/lib/constants';

export const GET = apiHandler(async () => {
  const user = requireUser(COORD_ROLES);
  const db = getDb();
  const percer = isPercer(user);
  const scope = ticketScope(user);
  const AND = scope.sql ? ` AND ${scope.sql}` : '';
  const WHERE = scope.sql ? ` WHERE ${scope.sql}` : '';
  const v = scope.vals;

  const byStatus = {};
  for (const r of db.prepare(`SELECT t.status, COUNT(*) AS n FROM tickets t${WHERE} GROUP BY t.status`).all(...v)) {
    byStatus[r.status] = r.n;
  }
  const byType = {};
  for (const r of db.prepare(
    `SELECT t.type, COUNT(*) AS n FROM tickets t WHERE t.status NOT IN ('VALIDE','ANNULE')${AND} GROUP BY t.type`
  ).all(...v)) {
    byType[r.type] = r.n;
  }

  // Blocages qui traînent : priorité absolue de la coordination
  const blockedAlerts = db.prepare(`
    SELECT t.id, t.reference, t.type, t.client_name, t.blockage_reason, t.blocked_at,
      u.name AS equipe_name, o.name AS org_name,
      CAST((julianday('now') - julianday(t.blocked_at)) * 24 AS INTEGER) AS hours_blocked
    FROM tickets t
    LEFT JOIN users u ON u.id = t.assigned_to
    LEFT JOIN organizations o ON o.id = t.org_id
    WHERE t.status = 'BLOQUE' AND t.blocked_at <= datetime('now', '-' || ? || ' hours')${AND}
    ORDER BY t.blocked_at`).all(BLOCKED_ALERT_HOURS, ...v);

  // File d'attente de contrôle : recette pour Percer, contrôle interne pour le ST
  const awaiting = percer ? 'VALIDE_ST' : 'REALISE';
  const toValidate = db.prepare(`
    SELECT t.id, t.reference, t.type, t.client_name, t.realized_at, t.power_db,
      u.name AS equipe_name, o.name AS org_name
    FROM tickets t
    LEFT JOIN users u ON u.id = t.assigned_to
    LEFT JOIN organizations o ON o.id = t.org_id
    WHERE t.status = ?${AND} ORDER BY t.realized_at LIMIT 20`).all(awaiting, ...v);

  // Percer suit ses sous-traitants ; un sous-traitant suit ses équipes
  const breakdown = percer
    ? db.prepare(`
        SELECT o.id, o.name, o.contact AS detail,
          SUM(CASE WHEN t.status IN ('DISPATCHE','AFFECTE','EN_COURS') THEN 1 ELSE 0 END) AS en_cours,
          SUM(CASE WHEN t.status IN ('REALISE','VALIDE_ST') THEN 1 ELSE 0 END) AS a_controler,
          SUM(CASE WHEN t.status = 'VALIDE' AND t.validated_at >= datetime('now','-30 days') THEN 1 ELSE 0 END) AS valides_30j,
          SUM(CASE WHEN t.status = 'BLOQUE' THEN 1 ELSE 0 END) AS bloques
        FROM organizations o LEFT JOIN tickets t ON t.org_id = o.id
        WHERE o.type = 'SOUS_TRAITANT' AND o.active = 1
        GROUP BY o.id ORDER BY o.name`).all()
    : db.prepare(`
        SELECT u.id, u.name, u.zone AS detail,
          SUM(CASE WHEN t.status IN ('AFFECTE','EN_COURS') THEN 1 ELSE 0 END) AS en_cours,
          SUM(CASE WHEN t.status IN ('REALISE','VALIDE_ST') THEN 1 ELSE 0 END) AS a_controler,
          SUM(CASE WHEN t.status = 'VALIDE' AND t.validated_at >= datetime('now','-30 days') THEN 1 ELSE 0 END) AS valides_30j,
          SUM(CASE WHEN t.status = 'BLOQUE' THEN 1 ELSE 0 END) AS bloques
        FROM users u LEFT JOIN tickets t ON t.assigned_to = u.id
        WHERE u.role = 'EQUIPE' AND u.active = 1 AND u.org_id = ?
        GROUP BY u.id ORDER BY u.name`).all(user.org_id);

  return Response.json({
    scope: percer ? 'PERCER' : 'ST',
    orgName: user.org_name,
    byStatus,
    byType,
    blockedAlerts,
    toValidate,
    breakdown,
  });
});
