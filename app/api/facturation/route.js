import { getDb } from '@/lib/db';
import { requireUser, apiHandler, isPercer } from '@/lib/auth';
import { monthlyStatement, availableMonths, defaultMonth } from '@/lib/facturation';
import { COORD_ROLES } from '@/lib/constants';

const MONTH_RE = /^\d{4}-\d{2}$/;

// Attachement mensuel. Un sous-traitant ne consulte que le sien.
export const GET = apiHandler(async (req) => {
  const user = requireUser(COORD_ROLES);
  const sp = new URL(req.url).searchParams;
  const percer = isPercer(user);
  const asked = Number(sp.get('org')) || null;
  // Une demande explicite sur une autre société est refusée, jamais silencieusement
  // remplacée par la sienne.
  if (!percer && asked && asked !== user.org_id) {
    return Response.json({ error: 'Accès refusé' }, { status: 403 });
  }
  const orgId = percer ? asked : user.org_id;
  const month = MONTH_RE.test(sp.get('month') || '') ? sp.get('month') : defaultMonth(orgId);

  const db = getDb();
  const organisations = percer
    ? db.prepare("SELECT id, name FROM organizations WHERE type = 'SOUS_TRAITANT' ORDER BY name").all()
    : db.prepare('SELECT id, name FROM organizations WHERE id = ?').all(user.org_id);

  if (!orgId) {
    // Vue Percer sans sélection : récapitulatif de tous les sous-traitants
    const summary = organisations.map((o) => {
      const s = monthlyStatement(o.id, month);
      return { org: o, totals: s.totals };
    });
    return Response.json({ organisations, months: availableMonths(null), month, summary });
  }

  const statement = monthlyStatement(orgId, month);
  if (!statement) return Response.json({ error: 'Société introuvable' }, { status: 404 });
  // Percer facture une société : le détail reste au ticket, pas à l'équipe
  const lines = percer
    ? statement.lines.map(({ equipe_name, ...l }) => l)
    : statement.lines;
  return Response.json({ organisations, months: availableMonths(orgId), ...statement, lines });
});
