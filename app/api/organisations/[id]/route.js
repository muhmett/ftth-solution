import { getDb } from '@/lib/db';
import { requireUser, apiHandler } from '@/lib/auth';
import { PERCER_ROLES } from '@/lib/constants';

// Modification d'un sous-traitant (Percer uniquement)
export const PATCH = apiHandler(async (req, { params }) => {
  requireUser(PERCER_ROLES);
  const id = Number(params.id);
  const body = await req.json();
  const db = getDb();
  const org = db.prepare('SELECT * FROM organizations WHERE id = ?').get(id);
  if (!org) return Response.json({ error: 'Société introuvable' }, { status: 404 });
  if (org.type === 'DONNEUR_ORDRE') {
    return Response.json({ error: 'Le donneur d\'ordre ne peut pas être modifié ici' }, { status: 400 });
  }

  const sets = [];
  const vals = [];
  if (body.name) { sets.push('name = ?'); vals.push(body.name.trim()); }
  if (body.contact !== undefined) { sets.push('contact = ?'); vals.push(body.contact); }
  if (body.active !== undefined) { sets.push('active = ?'); vals.push(body.active ? 1 : 0); }
  if (!sets.length) return Response.json({ error: 'Aucune modification' }, { status: 400 });

  vals.push(id);
  db.prepare(`UPDATE organizations SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
  return Response.json({ ok: true });
});
