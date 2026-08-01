import { getDb } from '@/lib/db';
import { requireUser, apiHandler } from '@/lib/auth';
import { getVapidKeys, sendToUser } from '@/lib/push';

// Clé publique VAPID + état de l'abonnement de l'appareil courant
export const GET = apiHandler(async (req) => {
  const user = requireUser();
  const endpoint = new URL(req.url).searchParams.get('endpoint');
  const subscribed = endpoint
    ? !!getDb().prepare('SELECT 1 FROM push_subscriptions WHERE user_id = ? AND endpoint = ?')
        .get(user.id, endpoint)
    : false;
  const count = getDb().prepare('SELECT COUNT(*) AS n FROM push_subscriptions WHERE user_id = ?')
    .get(user.id).n;
  return Response.json({ publicKey: getVapidKeys().publicKey, subscribed, devices: count });
});

// Enregistrement de l'appareil
export const POST = apiHandler(async (req) => {
  const user = requireUser();
  const { endpoint, keys } = await req.json();
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return Response.json({ error: 'Abonnement incomplet' }, { status: 400 });
  }
  getDb().prepare(`
    INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth) VALUES (?,?,?,?)
    ON CONFLICT (endpoint) DO UPDATE SET
      user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth`)
    .run(user.id, endpoint, keys.p256dh, keys.auth);

  await sendToUser(user.id, {
    title: 'Notifications activées',
    body: 'Vous serez prévenu dès qu\'un ticket vous est affecté.',
    tag: 'welcome',
  });
  return Response.json({ ok: true }, { status: 201 });
});

// Désinscription de l'appareil
export const DELETE = apiHandler(async (req) => {
  const user = requireUser();
  const { endpoint } = await req.json();
  if (!endpoint) return Response.json({ error: 'Endpoint requis' }, { status: 400 });
  getDb().prepare('DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint = ?')
    .run(user.id, endpoint);
  return Response.json({ ok: true });
});
