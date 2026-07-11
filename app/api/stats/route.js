import { getDb } from '@/lib/db';
import { requireUser, apiHandler } from '@/lib/auth';
import { BLOCKED_ALERT_HOURS } from '@/lib/constants';

export const GET = apiHandler(async () => {
  requireUser(['ADMIN', 'COORDINATEUR']);
  const db = getDb();

  const byStatus = {};
  for (const r of db.prepare('SELECT status, COUNT(*) AS n FROM tickets GROUP BY status').all()) {
    byStatus[r.status] = r.n;
  }
  const byType = {};
  for (const r of db.prepare("SELECT type, COUNT(*) AS n FROM tickets WHERE status NOT IN ('VALIDE','ANNULE') GROUP BY type").all()) {
    byType[r.type] = r.n;
  }

  // Tickets bloqués depuis plus de BLOCKED_ALERT_HOURS heures — à traiter en priorité
  const blockedAlerts = db.prepare(`
    SELECT t.id, t.reference, t.type, t.client_name, t.blockage_reason, t.blocked_at, u.name AS technicien_name,
      CAST((julianday('now') - julianday(t.blocked_at)) * 24 AS INTEGER) AS hours_blocked
    FROM tickets t LEFT JOIN users u ON u.id = t.assigned_to
    WHERE t.status = 'BLOQUE' AND t.blocked_at <= datetime('now', '-' || ? || ' hours')
    ORDER BY t.blocked_at`).all(BLOCKED_ALERT_HOURS);

  // Tickets réalisés en attente de validation
  const toValidate = db.prepare(`
    SELECT t.id, t.reference, t.type, t.client_name, t.realized_at, t.power_db, u.name AS technicien_name
    FROM tickets t LEFT JOIN users u ON u.id = t.assigned_to
    WHERE t.status = 'REALISE' ORDER BY t.realized_at LIMIT 20`).all();

  // Performance par technicien (30 derniers jours)
  const perTech = db.prepare(`
    SELECT u.id, u.name, u.zone,
      SUM(CASE WHEN t.status IN ('AFFECTE','EN_COURS') THEN 1 ELSE 0 END) AS en_cours,
      SUM(CASE WHEN t.status = 'REALISE' THEN 1 ELSE 0 END) AS realises,
      SUM(CASE WHEN t.status = 'VALIDE' AND t.validated_at >= datetime('now','-30 days') THEN 1 ELSE 0 END) AS valides_30j,
      SUM(CASE WHEN t.status = 'BLOQUE' THEN 1 ELSE 0 END) AS bloques
    FROM users u LEFT JOIN tickets t ON t.assigned_to = u.id
    WHERE u.role = 'TECHNICIEN' AND u.active = 1
    GROUP BY u.id ORDER BY u.name`).all();

  const validated7d = db.prepare(`
    SELECT date(validated_at) AS day, COUNT(*) AS n FROM tickets
    WHERE status = 'VALIDE' AND validated_at >= datetime('now','-7 days')
    GROUP BY day ORDER BY day`).all();

  return Response.json({ byStatus, byType, blockedAlerts, toValidate, perTech, validated7d });
});
