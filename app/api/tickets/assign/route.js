import { getDb, addHistory } from '@/lib/db';
import { requireUser, apiHandler, isPercer } from '@/lib/auth';
import { COORD_ROLES } from '@/lib/constants';

// Affectation en masse à une équipe : { ticket_ids, equipe_id }
// L'équipe et les tickets doivent appartenir à la même société.
export const POST = apiHandler(async (req) => {
  const user = requireUser(COORD_ROLES);
  const { ticket_ids, equipe_id } = await req.json();
  if (!Array.isArray(ticket_ids) || !ticket_ids.length) {
    return Response.json({ error: 'Aucun ticket sélectionné' }, { status: 400 });
  }
  const db = getDb();
  const equipe = db.prepare("SELECT * FROM users WHERE id = ? AND role = 'EQUIPE' AND active = 1")
    .get(Number(equipe_id));
  if (!equipe) return Response.json({ error: 'Équipe invalide' }, { status: 400 });
  if (!isPercer(user) && equipe.org_id !== user.org_id) {
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
        count++;
      }
    }
  })();

  return Response.json({ assigned: count, equipe: equipe.name });
});
