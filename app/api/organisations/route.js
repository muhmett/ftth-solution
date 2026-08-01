import { getDb } from '@/lib/db';
import { requireUser, apiHandler, isPercer } from '@/lib/auth';
import { PERCER_ROLES } from '@/lib/constants';

// Liste des sociétés. Un sous-traitant ne voit que la sienne.
export const GET = apiHandler(async (req) => {
  const user = requireUser();
  const db = getDb();
  const onlyST = new URL(req.url).searchParams.get('type') === 'SOUS_TRAITANT';

  if (!isPercer(user)) {
    return Response.json({
      organisations: db.prepare('SELECT id, name, type, contact, active FROM organizations WHERE id = ?')
        .all(user.org_id),
    });
  }
  const rows = db.prepare(`
    SELECT o.id, o.name, o.type, o.contact, o.active,
      (SELECT COUNT(*) FROM users u WHERE u.org_id = o.id AND u.role = 'EQUIPE' AND u.active = 1) AS equipes,
      (SELECT COUNT(*) FROM tickets t WHERE t.org_id = o.id
         AND t.status IN ('DISPATCHE','AFFECTE','EN_COURS','BLOQUE')) AS tickets_actifs
    FROM organizations o
    ${onlyST ? "WHERE o.type = 'SOUS_TRAITANT'" : ''}
    ORDER BY o.type DESC, o.name`).all();
  return Response.json({ organisations: rows });
});

// Création d'un sous-traitant (Percer uniquement)
export const POST = apiHandler(async (req) => {
  requireUser(PERCER_ROLES);
  const { name, contact } = await req.json();
  if (!name || !name.trim()) return Response.json({ error: 'Nom requis' }, { status: 400 });
  try {
    const info = getDb()
      .prepare("INSERT INTO organizations (name, type, contact) VALUES (?, 'SOUS_TRAITANT', ?)")
      .run(name.trim(), contact || '');
    return Response.json({ id: info.lastInsertRowid }, { status: 201 });
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) {
      return Response.json({ error: 'Cette société existe déjà' }, { status: 409 });
    }
    throw e;
  }
});
