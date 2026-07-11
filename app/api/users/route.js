import bcrypt from 'bcryptjs';
import { getDb } from '@/lib/db';
import { requireUser, apiHandler } from '@/lib/auth';

// Liste des utilisateurs (admin/coordinateur)
export const GET = apiHandler(async (req) => {
  requireUser(['ADMIN', 'COORDINATEUR']);
  const role = new URL(req.url).searchParams.get('role');
  const db = getDb();
  const rows = role
    ? db.prepare(
        `SELECT u.id, u.name, u.phone, u.role, u.zone, u.active,
           (SELECT COUNT(*) FROM tickets t WHERE t.assigned_to = u.id
              AND t.status IN ('AFFECTE','EN_COURS')) AS open_tickets
         FROM users u WHERE u.role = ? ORDER BY u.name`
      ).all(role)
    : db.prepare(
        `SELECT u.id, u.name, u.phone, u.role, u.zone, u.active,
           (SELECT COUNT(*) FROM tickets t WHERE t.assigned_to = u.id
              AND t.status IN ('AFFECTE','EN_COURS')) AS open_tickets
         FROM users u ORDER BY u.role, u.name`
      ).all();
  return Response.json({ users: rows });
});

// Création d'un utilisateur (admin uniquement)
export const POST = apiHandler(async (req) => {
  requireUser(['ADMIN']);
  const { name, phone, password, role, zone } = await req.json();
  if (!name || !phone || !password || !role) {
    return Response.json({ error: 'Champs requis : nom, téléphone, mot de passe, rôle' }, { status: 400 });
  }
  if (!['ADMIN', 'COORDINATEUR', 'TECHNICIEN'].includes(role)) {
    return Response.json({ error: 'Rôle invalide' }, { status: 400 });
  }
  try {
    const info = getDb()
      .prepare('INSERT INTO users (name, phone, password_hash, role, zone) VALUES (?,?,?,?,?)')
      .run(name.trim(), phone.trim(), bcrypt.hashSync(password, 10), role, zone || '');
    return Response.json({ id: info.lastInsertRowid }, { status: 201 });
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) {
      return Response.json({ error: 'Ce numéro de téléphone existe déjà' }, { status: 409 });
    }
    throw e;
  }
});
