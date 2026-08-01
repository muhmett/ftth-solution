import { getDb } from '@/lib/db';
import { requireUser, apiHandler, isPercer } from '@/lib/auth';
import { refreshDeadline } from '@/lib/contracts';
import { COORD_ROLES, PERCER_ROLES, DEFAULT_TERMS, TICKET_TYPES } from '@/lib/constants';

// Conditions contractuelles. Un sous-traitant consulte les siennes sans les modifier.
export const GET = apiHandler(async (req) => {
  const user = requireUser(COORD_ROLES);
  const db = getDb();
  const asked = Number(new URL(req.url).searchParams.get('org')) || null;
  const percer = isPercer(user);
  // Une demande explicite sur une autre société est refusée, jamais silencieusement
  // remplacée par la sienne.
  if (!percer && asked && asked !== user.org_id) {
    return Response.json({ error: 'Accès refusé' }, { status: 403 });
  }
  const orgId = percer ? asked : user.org_id;

  const orgs = percer
    ? db.prepare("SELECT id, name FROM organizations WHERE type = 'SOUS_TRAITANT' ORDER BY name").all()
    : db.prepare('SELECT id, name FROM organizations WHERE id = ?').all(user.org_id);

  if (!orgId) return Response.json({ organisations: orgs, terms: [] });

  const saved = db.prepare('SELECT * FROM contract_terms WHERE org_id = ?').all(orgId);
  // Une ligne par activité, complétée par les valeurs par défaut si non saisie
  const terms = Object.keys(TICKET_TYPES).map((type) => {
    const row = saved.find((t) => t.ticket_type === type);
    return {
      ticket_type: type,
      unit_price: row?.unit_price ?? DEFAULT_TERMS[type].unit_price,
      sla_hours: row?.sla_hours ?? DEFAULT_TERMS[type].sla_hours,
      penalty_rate: row?.penalty_rate ?? DEFAULT_TERMS[type].penalty_rate,
      configured: !!row,
    };
  });
  return Response.json({ organisations: orgs, org_id: orgId, terms });
});

// Enregistrement des conditions d'un sous-traitant (Percer uniquement)
export const PUT = apiHandler(async (req) => {
  requireUser(PERCER_ROLES);
  const { org_id, terms } = await req.json();
  const db = getDb();
  const org = db.prepare("SELECT * FROM organizations WHERE id = ? AND type = 'SOUS_TRAITANT'")
    .get(Number(org_id));
  if (!org) return Response.json({ error: 'Sous-traitant invalide' }, { status: 400 });
  if (!Array.isArray(terms) || !terms.length) {
    return Response.json({ error: 'Aucune condition fournie' }, { status: 400 });
  }

  const upsert = db.prepare(`
    INSERT INTO contract_terms (org_id, ticket_type, unit_price, sla_hours, penalty_rate, updated_at)
    VALUES (?,?,?,?,?, datetime('now'))
    ON CONFLICT (org_id, ticket_type) DO UPDATE SET
      unit_price = excluded.unit_price,
      sla_hours = excluded.sla_hours,
      penalty_rate = excluded.penalty_rate,
      updated_at = datetime('now')`);

  const affected = [];
  db.transaction(() => {
    for (const t of terms) {
      if (!TICKET_TYPES[t.ticket_type]) continue;
      const price = Math.max(0, Number(t.unit_price) || 0);
      const sla = Math.max(1, Math.round(Number(t.sla_hours) || 48));
      const penalty = Math.min(100, Math.max(0, Number(t.penalty_rate) || 0));
      upsert.run(org.id, t.ticket_type, price, sla, penalty);
      affected.push(t.ticket_type);
    }
    // Les délais courants suivent le nouveau contrat
    const open = db.prepare(`
      SELECT id FROM tickets WHERE org_id = ?
        AND status NOT IN ('VALIDE','ANNULE')
        AND type IN (${affected.map(() => '?').join(',') || "''"})`).all(org.id, ...affected);
    for (const t of open) refreshDeadline(t.id);
  })();

  return Response.json({ ok: true, updated: affected.length });
});
