import { getDb, addHistory } from '@/lib/db';
import { requireUser, apiHandler, ticketScope, isPercer, isCoord } from '@/lib/auth';
import { refreshDeadline, slaSql } from '@/lib/contracts';
import { COORD_ROLES, SLA_STATES } from '@/lib/constants';

const TYPES = ['FTTH', 'PARTAGE_IN', 'PARTAGE_OUT', 'SAV'];

// Liste des tickets. La portée dépend du rôle : Percer voit tout, un
// coordinateur sa société, une équipe ses propres tickets.
export const GET = apiHandler(async (req) => {
  const user = requireUser();
  const sp = new URL(req.url).searchParams;
  const scope = ticketScope(user);
  const where = scope.sql ? [scope.sql] : [];
  const vals = [...scope.vals];

  if (isCoord(user)) {
    const team = sp.get('equipe');
    if (team) { where.push('t.assigned_to = ?'); vals.push(Number(team)); }
    if (sp.get('unassigned') === '1') where.push('t.assigned_to IS NULL');
  }
  if (isPercer(user)) {
    const org = sp.get('org');
    if (org) { where.push('t.org_id = ?'); vals.push(Number(org)); }
    if (sp.get('undispatched') === '1') where.push('t.org_id IS NULL');
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
  const sla = sp.get('sla');
  if (sla && SLA_STATES[sla]) where.push(`(${slaSql('t')}) = '${sla}'`);

  const sql = `
    SELECT t.*, u.name AS equipe_name, o.name AS org_name,
      (${slaSql('t')}) AS sla_state,
      (SELECT COUNT(*) FROM ticket_photos p WHERE p.ticket_id = t.id) AS photo_count
    FROM tickets t
    LEFT JOIN users u ON u.id = t.assigned_to
    LEFT JOIN organizations o ON o.id = t.org_id
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY
      CASE t.status WHEN 'BLOQUE' THEN 0 WHEN 'REALISE' THEN 1 WHEN 'VALIDE_ST' THEN 2
        WHEN 'EN_COURS' THEN 3 WHEN 'AFFECTE' THEN 4 WHEN 'DISPATCHE' THEN 5
        WHEN 'NOUVEAU' THEN 6 ELSE 7 END,
      COALESCE(NULLIF(t.deadline, ''), t.rdv_date), t.updated_at DESC
    LIMIT 500`;
  return Response.json({ tickets: getDb().prepare(sql).all(...vals) });
});

// Création manuelle d'un ticket (coordination)
export const POST = apiHandler(async (req) => {
  const user = requireUser(COORD_ROLES);
  const b = await req.json();
  if (!b.reference || !TYPES.includes(b.type)) {
    return Response.json({ error: 'Référence et type valides requis' }, { status: 400 });
  }
  // Un coordinateur sous-traitant ne peut créer que pour sa propre société
  const orgId = isPercer(user) ? (b.org_id ? Number(b.org_id) : null) : user.org_id;
  const status = orgId ? 'DISPATCHE' : 'NOUVEAU';
  const info = getDb().prepare(`
    INSERT INTO tickets (reference, type, org_id, client_name, client_phone, address, city, zone,
      pbo, pto, nd, operator, rdv_date, notes, status, dispatched_at, created_by)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,${orgId ? "datetime('now')" : 'NULL'},?)
  `).run(
    b.reference.trim(), b.type, orgId, b.client_name || '', b.client_phone || '', b.address || '',
    b.city || '', b.zone || '', b.pbo || '', b.pto || '', b.nd || '', b.operator || '',
    b.rdv_date || '', b.notes || '', status, user.id
  );
  if (orgId) refreshDeadline(info.lastInsertRowid);
  addHistory(info.lastInsertRowid, 'CREATION', 'Ticket créé manuellement', user.id);
  return Response.json({ id: info.lastInsertRowid }, { status: 201 });
});
