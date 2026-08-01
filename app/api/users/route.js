import bcrypt from 'bcryptjs';
import { getDb } from '@/lib/db';
import { requireUser, apiHandler, isPercer } from '@/lib/auth';
import { COORD_ROLES, ROLES } from '@/lib/constants';

// Rôles qu'un coordinateur sous-traitant peut créer dans sa propre société
const ST_MANAGEABLE = ['ST_COORD', 'EQUIPE'];

// Liste des comptes, limitée à sa société pour un sous-traitant
export const GET = apiHandler(async (req) => {
  const user = requireUser(COORD_ROLES);
  const sp = new URL(req.url).searchParams;
  const where = [];
  const vals = [];

  if (isPercer(user)) {
    // Le donneur d'ordre gère ses propres comptes et les coordinateurs de ses
    // sous-traitants ; les équipes relèvent de la société qui les emploie.
    where.push("u.role != 'EQUIPE'");
    const org = sp.get('org');
    if (org) { where.push('u.org_id = ?'); vals.push(Number(org)); }
  } else {
    where.push('u.org_id = ?');
    vals.push(user.org_id);
  }
  const role = sp.get('role');
  if (role && ROLES[role]) { where.push('u.role = ?'); vals.push(role); }

  const rows = getDb().prepare(`
    SELECT u.id, u.name, u.phone, u.role, u.zone, u.active, u.member1, u.member2,
      u.org_id, o.name AS org_name,
      (SELECT COUNT(*) FROM tickets t WHERE t.assigned_to = u.id
         AND t.status IN ('AFFECTE','EN_COURS')) AS open_tickets
    FROM users u JOIN organizations o ON o.id = u.org_id
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY o.name, u.role, u.name`).all(...vals);
  return Response.json({ users: rows });
});

// Création d'un compte (équipe ou coordinateur)
export const POST = apiHandler(async (req) => {
  const user = requireUser(COORD_ROLES);
  const body = await req.json();
  const { name, phone, password, role, zone, member1, member2 } = body;
  if (!name || !phone || !password || !role) {
    return Response.json({ error: 'Champs requis : nom, téléphone, mot de passe, rôle' }, { status: 400 });
  }
  if (!ROLES[role]) return Response.json({ error: 'Rôle invalide' }, { status: 400 });

  // Percer place le compte dans la société choisie ; un sous-traitant reste chez lui
  let orgId;
  if (isPercer(user)) {
    if (user.role !== 'PERCER_ADMIN') {
      return Response.json({ error: 'Seul un administrateur Percer peut créer un compte' }, { status: 403 });
    }
    if (role === 'EQUIPE') {
      return Response.json(
        { error: 'Les équipes sont créées par le sous-traitant qui les emploie' }, { status: 403 });
    }
    orgId = body.org_id ? Number(body.org_id) : user.org_id;
  } else {
    if (!ST_MANAGEABLE.includes(role)) {
      return Response.json({ error: 'Rôle non autorisé pour un sous-traitant' }, { status: 403 });
    }
    orgId = user.org_id;
  }

  const db = getDb();
  const org = db.prepare('SELECT * FROM organizations WHERE id = ? AND active = 1').get(orgId);
  if (!org) return Response.json({ error: 'Société invalide' }, { status: 400 });
  // Un compte de pilotage Percer ne peut vivre que chez le donneur d'ordre
  const isPercerRole = role.startsWith('PERCER_');
  if (isPercerRole !== (org.type === 'DONNEUR_ORDRE')) {
    return Response.json({ error: 'Ce rôle ne correspond pas au type de société' }, { status: 400 });
  }

  try {
    const info = db.prepare(`
      INSERT INTO users (org_id, name, phone, password_hash, role, zone, member1, member2)
      VALUES (?,?,?,?,?,?,?,?)`).run(
      org.id, name.trim(), phone.trim(), bcrypt.hashSync(password, 10), role,
      zone || '', member1 || '', member2 || ''
    );
    return Response.json({ id: info.lastInsertRowid }, { status: 201 });
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) {
      return Response.json({ error: 'Ce numéro de téléphone existe déjà' }, { status: 409 });
    }
    throw e;
  }
});
