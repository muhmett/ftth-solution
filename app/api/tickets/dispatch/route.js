import { getDb, addHistory } from '@/lib/db';
import { requireUser, apiHandler } from '@/lib/auth';
import { PERCER_ROLES } from '@/lib/constants';

// Répartition en masse d'un lot vers un sous-traitant : { ticket_ids, org_id }
export const POST = apiHandler(async (req) => {
  const user = requireUser(PERCER_ROLES);
  const { ticket_ids, org_id } = await req.json();
  if (!Array.isArray(ticket_ids) || !ticket_ids.length) {
    return Response.json({ error: 'Aucun ticket sélectionné' }, { status: 400 });
  }
  const db = getDb();
  const org = db.prepare("SELECT * FROM organizations WHERE id = ? AND type = 'SOUS_TRAITANT' AND active = 1")
    .get(Number(org_id));
  if (!org) return Response.json({ error: 'Sous-traitant invalide' }, { status: 400 });

  const update = db.prepare(`
    UPDATE tickets SET org_id = ?, status = 'DISPATCHE', assigned_to = NULL,
      dispatched_at = datetime('now'), updated_at = datetime('now')
    WHERE id = ? AND status IN ('NOUVEAU','DISPATCHE','BLOQUE')`);
  let count = 0;
  db.transaction(() => {
    for (const tid of ticket_ids) {
      if (update.run(org.id, Number(tid)).changes) {
        addHistory(Number(tid), 'REPARTITION', `Réparti vers ${org.name}`, user.id);
        count++;
      }
    }
  })();

  return Response.json({ dispatched: count, organisation: org.name });
});
