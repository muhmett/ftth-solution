import { getDb } from '@/lib/db';
import { requireUser, apiHandler, isPercer } from '@/lib/auth';
import { MOVEMENT_KINDS } from '@/lib/constants';

// Qui peut enregistrer quoi. Percer livre, le sous-traitant gère son dépôt,
// l'équipe ne fait que consommer et rendre.
const ALLOWED = {
  PERCER_ADMIN: ['ENTREE', 'AJUSTEMENT'],
  PERCER_COORD: ['ENTREE', 'AJUSTEMENT'],
  ST_COORD: ['ENTREE', 'ATTRIBUTION', 'CONSOMMATION', 'RETOUR', 'PERTE', 'AJUSTEMENT'],
  EQUIPE: ['CONSOMMATION', 'RETOUR', 'PERTE'],
};

export const GET = apiHandler(async (req) => {
  const user = requireUser();
  const sp = new URL(req.url).searchParams;
  const percer = isPercer(user);
  const where = [];
  const vals = [];

  if (user.role === 'EQUIPE') {
    where.push('m.equipe_id = ?');
    vals.push(user.id);
  } else if (!percer) {
    where.push('m.org_id = ?');
    vals.push(user.org_id);
  } else if (sp.get('org')) {
    where.push('m.org_id = ?');
    vals.push(Number(sp.get('org')));
  }
  if (sp.get('material')) { where.push('m.material_id = ?'); vals.push(Number(sp.get('material'))); }

  const movements = getDb().prepare(`
    SELECT m.*, mat.reference, mat.label, mat.unit, o.name AS org_name,
      u.name AS equipe_name, c.name AS created_by_name, t.reference AS ticket_reference
    FROM stock_movements m
    JOIN materials mat ON mat.id = m.material_id
    JOIN organizations o ON o.id = m.org_id
    LEFT JOIN users u ON u.id = m.equipe_id
    LEFT JOIN users c ON c.id = m.created_by
    LEFT JOIN tickets t ON t.id = m.ticket_id
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY m.created_at DESC, m.id DESC LIMIT 200`).all(...vals);
  return Response.json({ movements });
});

// Enregistrement d'un mouvement : { kind, material_id, quantity, org_id?, equipe_id?, note? }
export const POST = apiHandler(async (req) => {
  const user = requireUser();
  const body = await req.json();
  const kind = body.kind;
  if (!MOVEMENT_KINDS[kind]) return Response.json({ error: 'Type de mouvement inconnu' }, { status: 400 });
  if (!(ALLOWED[user.role] || []).includes(kind)) {
    return Response.json({ error: 'Mouvement non autorisé pour votre rôle' }, { status: 403 });
  }

  const db = getDb();
  const percer = isPercer(user);
  // Percer choisit la société livrée ; les autres restent chez eux
  const orgId = percer ? Number(body.org_id) : user.org_id;
  const org = db.prepare("SELECT * FROM organizations WHERE id = ? AND type = 'SOUS_TRAITANT' AND active = 1")
    .get(orgId);
  if (!org) return Response.json({ error: 'Sous-traitant invalide' }, { status: 400 });

  const material = db.prepare('SELECT * FROM materials WHERE id = ? AND active = 1').get(Number(body.material_id));
  if (!material) return Response.json({ error: 'Référence matériel invalide' }, { status: 400 });

  const quantity = Number(body.quantity);
  if (Number.isNaN(quantity) || quantity === 0) {
    return Response.json({ error: 'Quantité invalide' }, { status: 400 });
  }
  // Seul un ajustement d'inventaire peut être négatif
  if (quantity < 0 && kind !== 'AJUSTEMENT') {
    return Response.json({ error: 'La quantité doit être positive' }, { status: 400 });
  }

  // L'emplacement concerné : véhicule d'une équipe ou dépôt
  let equipeId = null;
  if (user.role === 'EQUIPE') {
    equipeId = user.id;
  } else if (body.equipe_id) {
    const equipe = db.prepare("SELECT * FROM users WHERE id = ? AND role = 'EQUIPE' AND active = 1")
      .get(Number(body.equipe_id));
    if (!equipe) return Response.json({ error: 'Équipe invalide' }, { status: 400 });
    if (equipe.org_id !== org.id) {
      return Response.json({ error: 'Cette équipe appartient à une autre société' }, { status: 400 });
    }
    equipeId = equipe.id;
  }
  if (['ATTRIBUTION', 'CONSOMMATION'].includes(kind) && !equipeId) {
    return Response.json({ error: 'Une équipe doit être désignée pour ce mouvement' }, { status: 400 });
  }
  if (kind === 'ENTREE' && equipeId) {
    return Response.json({ error: 'Une livraison entre en dépôt, pas dans un véhicule' }, { status: 400 });
  }

  const info = db.prepare(`
    INSERT INTO stock_movements (org_id, material_id, kind, quantity, equipe_id, note, created_by)
    VALUES (?,?,?,?,?,?,?)`).run(
    org.id, material.id, kind, quantity, equipeId, body.note || '', user.id
  );
  return Response.json({ id: info.lastInsertRowid }, { status: 201 });
});
