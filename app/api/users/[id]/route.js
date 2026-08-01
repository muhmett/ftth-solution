import bcrypt from 'bcryptjs';
import { getDb } from '@/lib/db';
import { requireUser, apiHandler, isPercer } from '@/lib/auth';
import { COORD_ROLES, ROLES } from '@/lib/constants';

const ST_MANAGEABLE = ['ST_COORD', 'EQUIPE'];

// Modification d'un compte, dans la limite de sa société
export const PATCH = apiHandler(async (req, { params }) => {
  const user = requireUser(COORD_ROLES);
  const id = Number(params.id);
  const body = await req.json();
  const db = getDb();
  const target = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!target) return Response.json({ error: 'Compte introuvable' }, { status: 404 });

  if (isPercer(user)) {
    if (user.role !== 'PERCER_ADMIN') {
      return Response.json({ error: 'Seul un administrateur Percer peut modifier un compte' }, { status: 403 });
    }
  } else {
    if (target.org_id !== user.org_id || !ST_MANAGEABLE.includes(target.role)) {
      return Response.json({ error: 'Accès refusé' }, { status: 403 });
    }
  }

  const sets = [];
  const vals = [];
  if (body.name) { sets.push('name = ?'); vals.push(body.name.trim()); }
  if (body.phone) { sets.push('phone = ?'); vals.push(body.phone.trim()); }
  if (body.zone !== undefined) { sets.push('zone = ?'); vals.push(body.zone); }
  if (body.member1 !== undefined) { sets.push('member1 = ?'); vals.push(body.member1); }
  if (body.member2 !== undefined) { sets.push('member2 = ?'); vals.push(body.member2); }
  if (body.active !== undefined) { sets.push('active = ?'); vals.push(body.active ? 1 : 0); }
  if (body.password) { sets.push('password_hash = ?'); vals.push(bcrypt.hashSync(body.password, 10)); }
  if (body.role && ROLES[body.role]) {
    // Un sous-traitant ne peut pas promouvoir un compte hors de son périmètre
    if (!isPercer(user) && !ST_MANAGEABLE.includes(body.role)) {
      return Response.json({ error: 'Rôle non autorisé' }, { status: 403 });
    }
    sets.push('role = ?');
    vals.push(body.role);
  }
  if (!sets.length) return Response.json({ error: 'Aucune modification' }, { status: 400 });

  vals.push(id);
  try {
    db.prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) {
      return Response.json({ error: 'Ce numéro de téléphone existe déjà' }, { status: 409 });
    }
    throw e;
  }
  return Response.json({ ok: true });
});
