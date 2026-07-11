import { getDb, addHistory } from '@/lib/db';
import { requireUser, apiHandler } from '@/lib/auth';

// Affectation en masse : { ticket_ids: [..], technicien_id }
export const POST = apiHandler(async (req) => {
  const user = requireUser(['ADMIN', 'COORDINATEUR']);
  const { ticket_ids, technicien_id } = await req.json();
  if (!Array.isArray(ticket_ids) || !ticket_ids.length) {
    return Response.json({ error: 'Aucun ticket sélectionné' }, { status: 400 });
  }
  const db = getDb();
  const tech = db.prepare("SELECT * FROM users WHERE id = ? AND role = 'TECHNICIEN' AND active = 1").get(Number(technicien_id));
  if (!tech) return Response.json({ error: 'Technicien invalide' }, { status: 400 });

  const update = db.prepare(`
    UPDATE tickets SET assigned_to = ?, status = 'AFFECTE', updated_at = datetime('now')
    WHERE id = ? AND status IN ('NOUVEAU','AFFECTE','BLOQUE')`);
  let count = 0;
  const run = db.transaction(() => {
    for (const tid of ticket_ids) {
      const res = update.run(tech.id, Number(tid));
      if (res.changes) {
        addHistory(Number(tid), 'AFFECTATION', `Affecté à ${tech.name}`, user.id);
        count++;
      }
    }
  });
  run();
  return Response.json({ assigned: count, technicien: tech.name });
});
