import { getDb } from '@/lib/db';
import { requireUser, apiHandler } from '@/lib/auth';
import { PERCER_ROLES } from '@/lib/constants';

// Catalogue matériel : lisible par toute la chaîne, tenu par Percer.
export const GET = apiHandler(async (req) => {
  requireUser();
  const all = new URL(req.url).searchParams.get('all') === '1';
  const materials = getDb().prepare(`
    SELECT id, reference, label, unit, min_stock, active FROM materials
    ${all ? '' : 'WHERE active = 1'} ORDER BY label`).all();
  return Response.json({ materials });
});

export const POST = apiHandler(async (req) => {
  requireUser(PERCER_ROLES);
  const { reference, label, unit, min_stock } = await req.json();
  if (!reference?.trim() || !label?.trim()) {
    return Response.json({ error: 'Référence et libellé requis' }, { status: 400 });
  }
  try {
    const info = getDb().prepare(
      'INSERT INTO materials (reference, label, unit, min_stock) VALUES (?,?,?,?)'
    ).run(reference.trim(), label.trim(), unit?.trim() || 'unité', Math.max(0, Number(min_stock) || 0));
    return Response.json({ id: info.lastInsertRowid }, { status: 201 });
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) {
      return Response.json({ error: 'Cette référence existe déjà' }, { status: 409 });
    }
    throw e;
  }
});

export const PATCH = apiHandler(async (req) => {
  requireUser(PERCER_ROLES);
  const body = await req.json();
  const id = Number(body.id);
  const db = getDb();
  if (!db.prepare('SELECT 1 FROM materials WHERE id = ?').get(id)) {
    return Response.json({ error: 'Référence introuvable' }, { status: 404 });
  }
  const sets = [];
  const vals = [];
  if (body.label) { sets.push('label = ?'); vals.push(body.label.trim()); }
  if (body.unit) { sets.push('unit = ?'); vals.push(body.unit.trim()); }
  if (body.min_stock !== undefined) { sets.push('min_stock = ?'); vals.push(Math.max(0, Number(body.min_stock) || 0)); }
  if (body.active !== undefined) { sets.push('active = ?'); vals.push(body.active ? 1 : 0); }
  if (!sets.length) return Response.json({ error: 'Aucune modification' }, { status: 400 });
  vals.push(id);
  db.prepare(`UPDATE materials SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
  return Response.json({ ok: true });
});
