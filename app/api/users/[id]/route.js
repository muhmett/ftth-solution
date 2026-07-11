import bcrypt from 'bcryptjs';
import { getDb } from '@/lib/db';
import { requireUser, apiHandler } from '@/lib/auth';

// Modification d'un utilisateur (admin uniquement)
export const PATCH = apiHandler(async (req, { params }) => {
  requireUser(['ADMIN']);
  const id = Number(params.id);
  const body = await req.json();
  const db = getDb();
  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(id);
  if (!user) return Response.json({ error: 'Utilisateur introuvable' }, { status: 404 });

  const sets = [];
  const vals = [];
  if (body.name) { sets.push('name = ?'); vals.push(body.name.trim()); }
  if (body.phone) { sets.push('phone = ?'); vals.push(body.phone.trim()); }
  if (body.zone !== undefined) { sets.push('zone = ?'); vals.push(body.zone); }
  if (body.role && ['ADMIN', 'COORDINATEUR', 'TECHNICIEN'].includes(body.role)) {
    sets.push('role = ?'); vals.push(body.role);
  }
  if (body.active !== undefined) { sets.push('active = ?'); vals.push(body.active ? 1 : 0); }
  if (body.password) { sets.push('password_hash = ?'); vals.push(bcrypt.hashSync(body.password, 10)); }
  if (!sets.length) return Response.json({ error: 'Aucune modification' }, { status: 400 });

  vals.push(id);
  db.prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
  return Response.json({ ok: true });
});
