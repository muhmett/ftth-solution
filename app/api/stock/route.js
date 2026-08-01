import { getDb } from '@/lib/db';
import { requireUser, apiHandler, isPercer } from '@/lib/auth';
import { stockLevels, stockByTeam, consolidatedStock, lowStock, teamStock } from '@/lib/stock';

// État du stock, cadré sur le périmètre de l'appelant.
export const GET = apiHandler(async (req) => {
  const user = requireUser();
  const percer = isPercer(user);
  const asked = Number(new URL(req.url).searchParams.get('org')) || null;

  // Une équipe ne voit que ce qu'elle embarque
  if (user.role === 'EQUIPE') {
    return Response.json({ scope: 'EQUIPE', stock: teamStock(user.id) });
  }

  if (!percer && asked && asked !== user.org_id) {
    return Response.json({ error: 'Accès refusé' }, { status: 403 });
  }
  const orgId = percer ? asked : user.org_id;

  const db = getDb();
  const organisations = percer
    ? db.prepare("SELECT id, name FROM organizations WHERE type = 'SOUS_TRAITANT' AND active = 1 ORDER BY name").all()
    : db.prepare('SELECT id, name FROM organizations WHERE id = ?').all(user.org_id);

  if (!orgId) {
    return Response.json({ scope: 'PERCER', organisations, consolidated: consolidatedStock() });
  }
  return Response.json({
    scope: 'ORG',
    organisations,
    org_id: orgId,
    levels: stockLevels(orgId),
    // Percer voit ce qu'il reste chez la société, pas la dotation véhicule par véhicule
    byTeam: percer ? [] : stockByTeam(orgId),
    alerts: lowStock(orgId),
  });
});
