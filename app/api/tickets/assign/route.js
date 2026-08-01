import { getDb, addHistory } from '@/lib/db';
import { requireUser, apiHandler } from '@/lib/auth';
import { notifyTicketEvent } from '@/lib/push';

// Affectation en masse à une équipe : { ticket_ids, equipe_id }
// Réservée au sous-traitant : le donneur d'ordre confie un lot à une société,
// c'est elle qui décide quelle équipe intervient.
export const POST = apiHandler(async (req) => {
  const user = requireUser(['ST_COORD']);
  const { ticket_ids, equipe_id } = await req.json();
  if (!Array.isArray(ticket_ids) || !ticket_ids.length) {
    return Response.json({ error: 'Aucun ticket sélectionné' }, { status: 400 });
  }
  const db = getDb();
  const equipe = db.prepare("SELECT * FROM users WHERE id = ? AND role = 'EQUIPE' AND active = 1")
    .get(Number(equipe_id));
  if (!equipe) return Response.json({ error: 'Équipe invalide' }, { status: 400 });
  if (equipe.org_id !== user.org_id) {
    return Response.json({ error: 'Accès refusé' }, { status: 403 });
  }

  // Le filtre sur org_id garantit qu'un ticket d'une autre société ne peut pas
  // être détourné, même si son identifiant est fourni volontairement.
  const update = db.prepare(`
    UPDATE tickets SET assigned_to = ?, status = 'AFFECTE', updated_at = datetime('now')
    WHERE id = ? AND org_id = ? AND status IN ('DISPATCHE','AFFECTE','BLOQUE')`);
  let count = 0;
  db.transaction(() => {
    for (const tid of ticket_ids) {
      if (update.run(equipe.id, Number(tid), equipe.org_id).changes) {
        addHistory(Number(tid), 'AFFECTATION', `Affecté à ${equipe.name}`, user.id);
        notifyTicketEvent('AFFECTATION', Number(tid), equipe.id);
        count++;
      }
    }
  })();

  return Response.json({ assigned: count, equipe: equipe.name });
});
