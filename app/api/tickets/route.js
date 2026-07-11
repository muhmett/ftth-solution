import { getDb, addHistory } from '@/lib/db';
import { requireUser, apiHandler } from '@/lib/auth';

const TYPES = ['FTTH', 'PARTAGE_IN', 'PARTAGE_OUT', 'SAV'];

// Liste des tickets avec filtres.
// Un technicien ne voit que ses propres tickets.
export const GET = apiHandler(async (req) => {
  const user = requireUser();
  const sp = new URL(req.url).searchParams;
  const where = [];
  const vals = [];

  if (user.role === 'TECHNICIEN') {
    where.push('t.assigned_to = ?');
    vals.push(user.id);
  } else {
    const tech = sp.get('technicien');
    if (tech) { where.push('t.assigned_to = ?'); vals.push(Number(tech)); }
    if (sp.get('unassigned') === '1') where.push('t.assigned_to IS NULL');
  }
  const status = sp.get('status');
  if (status) {
    const list = status.split(',');
    where.push(`t.status IN (${list.map(() => '?').join(',')})`);
    vals.push(...list);
  }
  const type = sp.get('type');
  if (type && TYPES.includes(type)) { where.push('t.type = ?'); vals.push(type); }
  const q = sp.get('q');
  if (q) {
    where.push('(t.reference LIKE ? OR t.client_name LIKE ? OR t.client_phone LIKE ? OR t.address LIKE ? OR t.nd LIKE ?)');
    const like = `%${q}%`;
    vals.push(like, like, like, like, like);
  }

  const sql = `
    SELECT t.*, u.name AS technicien_name,
      (SELECT COUNT(*) FROM ticket_photos p WHERE p.ticket_id = t.id) AS photo_count
    FROM tickets t
    LEFT JOIN users u ON u.id = t.assigned_to
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY
      CASE t.status WHEN 'BLOQUE' THEN 0 WHEN 'REALISE' THEN 1 WHEN 'EN_COURS' THEN 2
        WHEN 'AFFECTE' THEN 3 WHEN 'NOUVEAU' THEN 4 ELSE 5 END,
      t.rdv_date, t.updated_at DESC
    LIMIT 500`;
  const tickets = getDb().prepare(sql).all(...vals);
  return Response.json({ tickets });
});

// Création manuelle d'un ticket (admin/coordinateur)
export const POST = apiHandler(async (req) => {
  const user = requireUser(['ADMIN', 'COORDINATEUR']);
  const b = await req.json();
  if (!b.reference || !TYPES.includes(b.type)) {
    return Response.json({ error: 'Référence et type valides requis' }, { status: 400 });
  }
  const db = getDb();
  const info = db.prepare(`
    INSERT INTO tickets (reference, type, client_name, client_phone, address, city, zone,
      pbo, pto, nd, operator, rdv_date, notes, assigned_to, status, created_by)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    b.reference.trim(), b.type, b.client_name || '', b.client_phone || '', b.address || '',
    b.city || '', b.zone || '', b.pbo || '', b.pto || '', b.nd || '', b.operator || '',
    b.rdv_date || '', b.notes || '', b.assigned_to || null,
    b.assigned_to ? 'AFFECTE' : 'NOUVEAU', user.id
  );
  addHistory(info.lastInsertRowid, 'CREATION', 'Ticket créé manuellement', user.id);
  if (b.assigned_to) addHistory(info.lastInsertRowid, 'AFFECTATION', `Affecté au technicien #${b.assigned_to}`, user.id);
  return Response.json({ id: info.lastInsertRowid }, { status: 201 });
});
