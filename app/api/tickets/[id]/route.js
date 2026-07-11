import { getDb, addHistory, touchTicket } from '@/lib/db';
import { requireUser, apiHandler } from '@/lib/auth';
import { REQUIRED_PHOTOS, BLOCKAGE_REASONS } from '@/lib/constants';

function loadTicket(db, id) {
  return db.prepare(`
    SELECT t.*, u.name AS technicien_name, u.phone AS technicien_phone, v.name AS validated_by_name
    FROM tickets t
    LEFT JOIN users u ON u.id = t.assigned_to
    LEFT JOIN users v ON v.id = t.validated_by
    WHERE t.id = ?`).get(id);
}

// Détail d'un ticket avec photos + historique
export const GET = apiHandler(async (req, { params }) => {
  const user = requireUser();
  const db = getDb();
  const ticket = loadTicket(db, Number(params.id));
  if (!ticket) return Response.json({ error: 'Ticket introuvable' }, { status: 404 });
  if (user.role === 'TECHNICIEN' && ticket.assigned_to !== user.id) {
    return Response.json({ error: 'Accès refusé' }, { status: 403 });
  }
  const photos = db.prepare(
    'SELECT id, photo_type, file_path, created_at FROM ticket_photos WHERE ticket_id = ? ORDER BY created_at'
  ).all(ticket.id);
  const history = db.prepare(`
    SELECT h.action, h.detail, h.created_at, u.name AS user_name
    FROM ticket_history h LEFT JOIN users u ON u.id = h.user_id
    WHERE h.ticket_id = ? ORDER BY h.created_at DESC, h.id DESC`).all(ticket.id);
  return Response.json({ ticket, photos, history });
});

// Actions sur un ticket : { action: 'assign'|'start'|'realize'|'block'|'validate'|'reject'|'unblock'|'cancel'|'update', ... }
export const PATCH = apiHandler(async (req, { params }) => {
  const user = requireUser();
  const id = Number(params.id);
  const body = await req.json();
  const db = getDb();
  const ticket = loadTicket(db, id);
  if (!ticket) return Response.json({ error: 'Ticket introuvable' }, { status: 404 });

  const isManager = ['ADMIN', 'COORDINATEUR'].includes(user.role);
  const isMine = ticket.assigned_to === user.id;
  const fail = (msg, status = 400) => Response.json({ error: msg }, { status });

  switch (body.action) {
    case 'assign': {
      if (!isManager) return fail('Accès refusé', 403);
      const techId = Number(body.technicien_id);
      const tech = db.prepare("SELECT * FROM users WHERE id = ? AND role = 'TECHNICIEN' AND active = 1").get(techId);
      if (!tech) return fail('Technicien invalide');
      db.prepare("UPDATE tickets SET assigned_to = ?, status = 'AFFECTE' WHERE id = ?").run(techId, id);
      addHistory(id, 'AFFECTATION', `Affecté à ${tech.name}`, user.id);
      break;
    }
    case 'start': {
      if (!isMine) return fail('Ce ticket ne vous est pas affecté', 403);
      if (ticket.status !== 'AFFECTE') return fail(`Impossible de démarrer un ticket en statut ${ticket.status}`);
      db.prepare("UPDATE tickets SET status = 'EN_COURS' WHERE id = ?").run(id);
      addHistory(id, 'DEMARRAGE', 'Intervention démarrée', user.id);
      break;
    }
    case 'realize': {
      // Clôture par le technicien : photos obligatoires + mesure optique pour la production
      if (!isMine) return fail('Ce ticket ne vous est pas affecté', 403);
      if (!['EN_COURS', 'AFFECTE'].includes(ticket.status)) {
        return fail(`Impossible de clôturer un ticket en statut ${ticket.status}`);
      }
      const photos = db.prepare('SELECT DISTINCT photo_type FROM ticket_photos WHERE ticket_id = ?').all(id)
        .map((p) => p.photo_type);
      const required = REQUIRED_PHOTOS[ticket.type] || [];
      const missing = required.filter((r) => !photos.includes(r));
      if (missing.length) {
        return fail(`Photos obligatoires manquantes : ${missing.join(', ')}`);
      }
      const isProd = ticket.type !== 'SAV';
      const power = body.power_db !== undefined && body.power_db !== '' ? Number(body.power_db) : null;
      if (isProd && (power === null || Number.isNaN(power))) {
        return fail('La mesure photomètre (dB) est obligatoire');
      }
      if (isProd && (power < -30 || power > -8)) {
        return fail(`Puissance ${power} dB hors plage acceptable (-30 à -8 dB). Vérifiez la mesure.`);
      }
      db.prepare(`UPDATE tickets SET status = 'REALISE', power_db = ?, router_sn = ?,
        notes = CASE WHEN ? != '' THEN ? ELSE notes END,
        realized_at = datetime('now'), blockage_reason = '', blockage_comment = '', blocked_at = NULL
        WHERE id = ?`)
        .run(power, body.router_sn || ticket.router_sn || '', body.comment || '', body.comment || '', id);
      addHistory(id, 'REALISATION', power !== null ? `Réalisé — puissance ${power} dB` : 'Réalisé', user.id);
      break;
    }
    case 'block': {
      if (!isMine && !isManager) return fail('Accès refusé', 403);
      if (!BLOCKAGE_REASONS[body.reason]) return fail('Motif de blocage invalide');
      if (['VALIDE', 'ANNULE'].includes(ticket.status)) return fail('Ticket déjà clôturé');
      db.prepare(`UPDATE tickets SET status = 'BLOQUE', blockage_reason = ?, blockage_comment = ?,
        blocked_at = datetime('now') WHERE id = ?`).run(body.reason, body.comment || '', id);
      addHistory(id, 'BLOCAGE', `${BLOCKAGE_REASONS[body.reason]}${body.comment ? ' — ' + body.comment : ''}`, user.id);
      break;
    }
    case 'validate': {
      if (!isManager) return fail('Accès refusé', 403);
      if (ticket.status !== 'REALISE') return fail('Seul un ticket réalisé peut être validé');
      db.prepare(`UPDATE tickets SET status = 'VALIDE', validated_at = datetime('now'), validated_by = ? WHERE id = ?`)
        .run(user.id, id);
      addHistory(id, 'VALIDATION', body.comment || 'Ticket validé par la coordination', user.id);
      break;
    }
    case 'reject': {
      // Retour au technicien si les preuves sont insuffisantes
      if (!isManager) return fail('Accès refusé', 403);
      if (ticket.status !== 'REALISE') return fail('Seul un ticket réalisé peut être rejeté');
      db.prepare("UPDATE tickets SET status = 'AFFECTE', realized_at = NULL WHERE id = ?").run(id);
      addHistory(id, 'REJET', body.comment || 'Preuves insuffisantes — à refaire', user.id);
      break;
    }
    case 'unblock': {
      // Replanification d'un ticket bloqué
      if (!isManager) return fail('Accès refusé', 403);
      if (ticket.status !== 'BLOQUE') return fail('Ticket non bloqué');
      const newStatus = ticket.assigned_to ? 'AFFECTE' : 'NOUVEAU';
      db.prepare(`UPDATE tickets SET status = ?, blockage_reason = '', blockage_comment = '',
        blocked_at = NULL, rdv_date = COALESCE(NULLIF(?, ''), rdv_date) WHERE id = ?`)
        .run(newStatus, body.rdv_date || '', id);
      addHistory(id, 'REPLANIFICATION', body.comment || 'Ticket replanifié', user.id);
      break;
    }
    case 'cancel': {
      if (!isManager) return fail('Accès refusé', 403);
      db.prepare("UPDATE tickets SET status = 'ANNULE' WHERE id = ?").run(id);
      addHistory(id, 'ANNULATION', body.comment || 'Ticket annulé', user.id);
      break;
    }
    case 'update': {
      if (!isManager) return fail('Accès refusé', 403);
      const fields = ['client_name', 'client_phone', 'address', 'city', 'zone', 'pbo', 'pto', 'nd', 'operator', 'rdv_date', 'notes'];
      const sets = [];
      const vals = [];
      for (const f of fields) {
        if (body[f] !== undefined) { sets.push(`${f} = ?`); vals.push(body[f]); }
      }
      if (!sets.length) return fail('Aucune modification');
      vals.push(id);
      db.prepare(`UPDATE tickets SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
      addHistory(id, 'MODIFICATION', 'Informations mises à jour', user.id);
      break;
    }
    default:
      return fail('Action inconnue');
  }

  touchTicket(id);
  return Response.json({ ticket: loadTicket(db, id) });
});
