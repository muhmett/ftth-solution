import { getDb, addHistory, touchTicket } from '@/lib/db';
import { requireUser, apiHandler, isPercer, isCoord, assertTicketAccess } from '@/lib/auth';
import { refreshDeadline, slaSql } from '@/lib/contracts';
import { notifyTicketEvent } from '@/lib/push';
import { REQUIRED_PHOTOS, BLOCKAGE_REASONS } from '@/lib/constants';

function loadTicket(db, id) {
  return db.prepare(`
    SELECT t.*, u.name AS equipe_name, u.phone AS equipe_phone, u.member1, u.member2,
           o.name AS org_name, v.name AS validated_by_name, vs.name AS validated_st_by_name,
           (${slaSql('t')}) AS sla_state
    FROM tickets t
    LEFT JOIN users u ON u.id = t.assigned_to
    LEFT JOIN organizations o ON o.id = t.org_id
    LEFT JOIN users v ON v.id = t.validated_by
    LEFT JOIN users vs ON vs.id = t.validated_st_by
    WHERE t.id = ?`).get(id);
}

// Détail d'un ticket avec photos + historique
export const GET = apiHandler(async (req, { params }) => {
  const user = requireUser();
  const db = getDb();
  const ticket = loadTicket(db, Number(params.id));
  if (!ticket) return Response.json({ error: 'Ticket introuvable' }, { status: 404 });
  assertTicketAccess(user, ticket);

  const photos = db.prepare(
    'SELECT id, photo_type, file_path, created_at FROM ticket_photos WHERE ticket_id = ? ORDER BY created_at'
  ).all(ticket.id);
  const history = db.prepare(`
    SELECT h.action, h.detail, h.created_at, u.name AS user_name
    FROM ticket_history h LEFT JOIN users u ON u.id = h.user_id
    WHERE h.ticket_id = ? ORDER BY h.created_at DESC, h.id DESC`).all(ticket.id);
  return Response.json({ ticket, photos, history });
});

// Actions sur un ticket. Le contrôle qualité se fait à deux niveaux :
// l'équipe réalise, le coordinateur du sous-traitant contrôle, Percer prononce
// la recette finale (seul statut facturable).
export const PATCH = apiHandler(async (req, { params }) => {
  const user = requireUser();
  const id = Number(params.id);
  const body = await req.json();
  const db = getDb();
  const ticket = loadTicket(db, id);
  if (!ticket) return Response.json({ error: 'Ticket introuvable' }, { status: 404 });
  assertTicketAccess(user, ticket);

  const percer = isPercer(user);
  const coord = isCoord(user);
  const isMine = ticket.assigned_to === user.id;
  const fail = (msg, status = 400) => Response.json({ error: msg }, { status });

  switch (body.action) {
    case 'dispatch': {
      // Répartition d'un ticket vers un sous-traitant
      if (!percer) return fail('Accès refusé', 403);
      if (!['NOUVEAU', 'DISPATCHE', 'BLOQUE'].includes(ticket.status)) {
        return fail(`Impossible de répartir un ticket en statut ${ticket.status}`);
      }
      const org = db.prepare("SELECT * FROM organizations WHERE id = ? AND type = 'SOUS_TRAITANT' AND active = 1")
        .get(Number(body.org_id));
      if (!org) return fail('Sous-traitant invalide');
      db.prepare(`UPDATE tickets SET org_id = ?, status = 'DISPATCHE', assigned_to = NULL,
        dispatched_at = datetime('now') WHERE id = ?`).run(org.id, id);
      refreshDeadline(id);
      addHistory(id, 'REPARTITION', `Réparti vers ${org.name}`, user.id);
      break;
    }
    case 'assign': {
      // Affectation à une équipe du sous-traitant détenteur
      if (!coord) return fail('Accès refusé', 403);
      if (!ticket.org_id) return fail('Le ticket doit d\'abord être réparti vers un sous-traitant');
      const equipe = db.prepare("SELECT * FROM users WHERE id = ? AND role = 'EQUIPE' AND active = 1")
        .get(Number(body.equipe_id));
      if (!equipe) return fail('Équipe invalide');
      if (equipe.org_id !== ticket.org_id) return fail('Cette équipe appartient à une autre société');
      db.prepare("UPDATE tickets SET assigned_to = ?, status = 'AFFECTE' WHERE id = ?").run(equipe.id, id);
      addHistory(id, 'AFFECTATION', `Affecté à ${equipe.name}`, user.id);
      notifyTicketEvent('AFFECTATION', id, equipe.id);
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
      // Clôture par l'équipe : photos obligatoires + mesure optique en production
      if (!isMine) return fail('Ce ticket ne vous est pas affecté', 403);
      if (!['EN_COURS', 'AFFECTE'].includes(ticket.status)) {
        return fail(`Impossible de clôturer un ticket en statut ${ticket.status}`);
      }
      const photos = db.prepare('SELECT DISTINCT photo_type FROM ticket_photos WHERE ticket_id = ?').all(id)
        .map((p) => p.photo_type);
      const missing = (REQUIRED_PHOTOS[ticket.type] || []).filter((r) => !photos.includes(r));
      if (missing.length) return fail(`Photos obligatoires manquantes : ${missing.join(', ')}`);

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
    case 'validate': {
      if (!coord) return fail('Accès refusé', 403);
      if (ticket.status === 'REALISE') {
        // Contrôle qualité interne du sous-traitant
        db.prepare(`UPDATE tickets SET status = 'VALIDE_ST', validated_st_at = datetime('now'),
          validated_st_by = ? WHERE id = ?`).run(user.id, id);
        addHistory(id, 'CONTROLE_ST', body.comment || 'Contrôlé par le sous-traitant', user.id);
      } else if (ticket.status === 'VALIDE_ST') {
        // Recette finale : seul Percer peut la prononcer
        if (!percer) return fail('Seul Percer peut prononcer la recette finale', 403);
        db.prepare(`UPDATE tickets SET status = 'VALIDE', validated_at = datetime('now'),
          validated_by = ? WHERE id = ?`).run(user.id, id);
        addHistory(id, 'RECETTE', body.comment || 'Recette validée par Percer', user.id);
      } else {
        return fail('Ce ticket n\'est pas en attente de contrôle');
      }
      break;
    }
    case 'reject': {
      // Preuves insuffisantes : le ticket repart chez l'équipe
      if (!coord) return fail('Accès refusé', 403);
      if (!['REALISE', 'VALIDE_ST'].includes(ticket.status)) {
        return fail('Seul un ticket réalisé ou contrôlé peut être rejeté');
      }
      if (ticket.status === 'VALIDE_ST' && !percer) {
        return fail('Ce ticket est déjà contrôlé, seul Percer peut le rejeter', 403);
      }
      const from = ticket.status === 'VALIDE_ST' ? 'Percer' : 'la coordination';
      db.prepare(`UPDATE tickets SET status = 'AFFECTE', realized_at = NULL,
        validated_st_at = NULL, validated_st_by = NULL WHERE id = ?`).run(id);
      addHistory(id, 'REJET', `Rejeté par ${from} — ${body.comment || 'preuves insuffisantes'}`, user.id);
      notifyTicketEvent('REJET', id, ticket.assigned_to, body.comment);
      break;
    }
    case 'block': {
      if (!isMine && !coord) return fail('Accès refusé', 403);
      if (!BLOCKAGE_REASONS[body.reason]) return fail('Motif de blocage invalide');
      if (['VALIDE', 'ANNULE'].includes(ticket.status)) return fail('Ticket déjà clôturé');
      db.prepare(`UPDATE tickets SET status = 'BLOQUE', blockage_reason = ?, blockage_comment = ?,
        blocked_at = datetime('now') WHERE id = ?`).run(body.reason, body.comment || '', id);
      addHistory(id, 'BLOCAGE', `${BLOCKAGE_REASONS[body.reason]}${body.comment ? ' — ' + body.comment : ''}`, user.id);
      break;
    }
    case 'unblock': {
      if (!coord) return fail('Accès refusé', 403);
      if (ticket.status !== 'BLOQUE') return fail('Ticket non bloqué');
      const newStatus = ticket.assigned_to ? 'AFFECTE' : ticket.org_id ? 'DISPATCHE' : 'NOUVEAU';
      db.prepare(`UPDATE tickets SET status = ?, blockage_reason = '', blockage_comment = '',
        blocked_at = NULL, rdv_date = COALESCE(NULLIF(?, ''), rdv_date) WHERE id = ?`)
        .run(newStatus, body.rdv_date || '', id);
      refreshDeadline(id);
      addHistory(id, 'REPLANIFICATION', body.comment || 'Ticket replanifié', user.id);
      if (ticket.assigned_to) notifyTicketEvent('REPLANIFICATION', id, ticket.assigned_to);
      break;
    }
    case 'cancel': {
      // L'annulation vient du donneur d'ordre (décision client / opérateur)
      if (!percer) return fail('Seul Percer peut annuler un ticket', 403);
      db.prepare("UPDATE tickets SET status = 'ANNULE' WHERE id = ?").run(id);
      addHistory(id, 'ANNULATION', body.comment || 'Ticket annulé', user.id);
      break;
    }
    case 'update': {
      if (!coord) return fail('Accès refusé', 403);
      const fields = ['client_name', 'client_phone', 'address', 'city', 'zone', 'pbo', 'pto', 'nd', 'operator', 'rdv_date', 'notes'];
      const sets = [];
      const vals = [];
      for (const f of fields) {
        if (body[f] !== undefined) { sets.push(`${f} = ?`); vals.push(body[f]); }
      }
      if (!sets.length) return fail('Aucune modification');
      vals.push(id);
      db.prepare(`UPDATE tickets SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
      if (body.rdv_date !== undefined) refreshDeadline(id);
      addHistory(id, 'MODIFICATION', 'Informations mises à jour', user.id);
      break;
    }
    default:
      return fail('Action inconnue');
  }

  touchTicket(id);
  return Response.json({ ticket: loadTicket(db, id) });
});
