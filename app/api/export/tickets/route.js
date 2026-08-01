import * as XLSX from 'xlsx';
import { getDb } from '@/lib/db';
import { requireUser, apiHandler, ticketScope, isPercer, isCoord } from '@/lib/auth';
import { slaSql } from '@/lib/contracts';
import { COORD_ROLES, TICKET_TYPES, TICKET_STATUS, SLA_STATES, BLOCKAGE_REASONS } from '@/lib/constants';

const TYPES = ['FTTH', 'PARTAGE_IN', 'PARTAGE_OUT', 'SAV'];

// Export Excel des tickets, à renvoyer à l'opérateur ou à archiver.
// Reprend les filtres de la liste et la même portée de lecture.
export const GET = apiHandler(async (req) => {
  const user = requireUser(COORD_ROLES);
  const sp = new URL(req.url).searchParams;
  const scope = ticketScope(user);
  const where = scope.sql ? [scope.sql] : [];
  const vals = [...scope.vals];

  if (isPercer(user)) {
    const org = sp.get('org');
    if (org) { where.push('t.org_id = ?'); vals.push(Number(org)); }
  }
  if (isCoord(user)) {
    const equipe = sp.get('equipe');
    if (equipe) { where.push('t.assigned_to = ?'); vals.push(Number(equipe)); }
  }
  const status = sp.get('status');
  if (status) {
    const list = status.split(',').filter((s) => TICKET_STATUS[s]);
    if (list.length) {
      where.push(`t.status IN (${list.map(() => '?').join(',')})`);
      vals.push(...list);
    }
  }
  const type = sp.get('type');
  if (type && TYPES.includes(type)) { where.push('t.type = ?'); vals.push(type); }
  const sla = sp.get('sla');
  if (sla && SLA_STATES[sla]) where.push(`(${slaSql('t')}) = '${sla}'`);
  const from = sp.get('from');
  if (from) { where.push('date(t.created_at) >= date(?)'); vals.push(from); }
  const to = sp.get('to');
  if (to) { where.push('date(t.created_at) <= date(?)'); vals.push(to); }

  const rows = getDb().prepare(`
    SELECT t.*, u.name AS equipe_name, u.member1, u.member2, o.name AS org_name,
      (${slaSql('t')}) AS sla_state,
      (SELECT COUNT(*) FROM ticket_photos p WHERE p.ticket_id = t.id) AS photo_count
    FROM tickets t
    LEFT JOIN users u ON u.id = t.assigned_to
    LEFT JOIN organizations o ON o.id = t.org_id
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY t.reference LIMIT 20000`).all(...vals);

  const header = [
    'Référence', 'Activité', 'Statut', 'Sous-traitant', 'Équipe', 'Intervenants',
    'Client', 'Téléphone', 'Adresse', 'Ville', 'Zone',
    'ND', 'PBO', 'PTO', 'Opérateur infra',
    'RDV', 'Échéance', 'Respect du délai',
    'Réalisé le', 'Puissance (dB)', 'S/N Routeur', 'Photos',
    'Contrôlé ST le', 'Recette le', 'Motif de blocage', 'Commentaire',
  ];
  const data = rows.map((t) => [
    t.reference, TICKET_TYPES[t.type]?.label || t.type, TICKET_STATUS[t.status]?.label || t.status,
    t.org_name || '', t.equipe_name || '',
    [t.member1, t.member2].filter(Boolean).join(' + '),
    t.client_name, t.client_phone, t.address, t.city, t.zone,
    t.nd, t.pbo, t.pto, t.operator,
    t.rdv_date, t.deadline || '', SLA_STATES[t.sla_state]?.label || '',
    t.realized_at || '', t.power_db ?? '', t.router_sn || '', t.photo_count,
    t.validated_st_at || '', t.validated_at || '',
    BLOCKAGE_REASONS[t.blockage_reason] || '', t.notes || '',
  ]);

  const ws = XLSX.utils.aoa_to_sheet([header, ...data]);
  ws['!cols'] = header.map((h) => ({ wch: Math.max(12, Math.min(30, h.length + 6)) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Tickets');

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="tickets_${stamp}.xlsx"`,
    },
  });
});
