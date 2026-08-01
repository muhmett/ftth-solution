import * as XLSX from 'xlsx';
import { requireUser, apiHandler, isPercer } from '@/lib/auth';
import { monthlyStatement, defaultMonth } from '@/lib/facturation';
import { COORD_ROLES, TICKET_TYPES, CURRENCY } from '@/lib/constants';

const MONTH_RE = /^\d{4}-\d{2}$/;

// Export Excel de l'attachement : une feuille de détail + une de récapitulatif
export const GET = apiHandler(async (req) => {
  const user = requireUser(COORD_ROLES);
  const sp = new URL(req.url).searchParams;
  const percer = isPercer(user);
  const asked = Number(sp.get('org')) || null;
  if (!percer && asked && asked !== user.org_id) {
    return Response.json({ error: 'Accès refusé' }, { status: 403 });
  }
  const orgId = percer ? asked : user.org_id;
  if (!orgId) return Response.json({ error: 'Sous-traitant requis' }, { status: 400 });
  const month = MONTH_RE.test(sp.get('month') || '') ? sp.get('month') : defaultMonth(orgId);

  const s = monthlyStatement(orgId, month);
  if (!s) return Response.json({ error: 'Société introuvable' }, { status: 404 });

  const detail = [
    ['Référence', 'Activité', 'Client', 'Adresse', 'Ville', 'Équipe',
      'Réalisé le', 'Échéance', 'Hors délai', 'Recette le',
      `Prix (${CURRENCY})`, `Retenue (${CURRENCY})`, `Net (${CURRENCY})`],
    ...s.lines.map((l) => [
      l.reference, TICKET_TYPES[l.type]?.label || l.type, l.client_name, l.address, l.city,
      l.equipe_name || '', l.realized_at || '', l.deadline || '', l.late ? 'OUI' : 'NON',
      l.validated_at || '', l.unit_price, l.penalty, l.net,
    ]),
  ];

  const recap = [
    ['Attachement mensuel'],
    ['Sous-traitant', s.org.name],
    ['Période', month],
    ['Édité le', new Date().toISOString().slice(0, 16).replace('T', ' ')],
    [],
    ['Activité', 'Quantité', `Prix unitaire (${CURRENCY})`, `Brut (${CURRENCY})`,
      `Retenues (${CURRENCY})`, `Net (${CURRENCY})`],
    ...s.byType.map((r) => [
      TICKET_TYPES[r.type]?.label || r.type, r.count, r.unit_price, r.brut, r.penalites, r.net,
    ]),
    [],
    ['TOTAL', s.totals.count, '', s.totals.brut, s.totals.penalites, s.totals.net],
    ['dont hors délai', s.totals.late],
  ];

  const wb = XLSX.utils.book_new();
  const wsRecap = XLSX.utils.aoa_to_sheet(recap);
  wsRecap['!cols'] = [{ wch: 24 }, { wch: 12 }, { wch: 18 }, { wch: 14 }, { wch: 16 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, wsRecap, 'Récapitulatif');

  const wsDetail = XLSX.utils.aoa_to_sheet(detail);
  wsDetail['!cols'] = [{ wch: 18 }, { wch: 18 }, { wch: 22 }, { wch: 28 }, { wch: 14 },
    { wch: 20 }, { wch: 18 }, { wch: 18 }, { wch: 11 }, { wch: 18 },
    { wch: 12 }, { wch: 14 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, wsDetail, 'Détail');

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  const filename = `attachement_${s.org.name.replace(/[^a-zA-Z0-9]+/g, '-')}_${month}.xlsx`;
  return new Response(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
});
