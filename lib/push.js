import webpush from 'web-push';
import { getDb } from './db';
import { TICKET_TYPES } from './constants';

const SUBJECT = process.env.PUSH_SUBJECT || 'mailto:contact@percer.ma';

// Les clés VAPID sont générées une fois puis conservées : sans elles, les
// abonnements déjà enregistrés dans les téléphones deviendraient invalides.
export function getVapidKeys() {
  const db = getDb();
  const read = db.prepare('SELECT value FROM app_settings WHERE key = ?');
  let pub = read.get('vapid_public')?.value;
  let priv = read.get('vapid_private')?.value;
  if (!pub || !priv) {
    const keys = webpush.generateVAPIDKeys();
    pub = keys.publicKey;
    priv = keys.privateKey;
    const write = db.prepare('INSERT OR REPLACE INTO app_settings (key, value) VALUES (?,?)');
    write.run('vapid_public', pub);
    write.run('vapid_private', priv);
  }
  return { publicKey: pub, privateKey: priv };
}

function configured() {
  const { publicKey, privateKey } = getVapidKeys();
  webpush.setVapidDetails(SUBJECT, publicKey, privateKey);
  return true;
}

/**
 * Envoi à tous les appareils d'un utilisateur. Volontairement silencieux : une
 * notification qui échoue ne doit jamais faire échouer l'action métier.
 * Les abonnements refusés par le navigateur (404/410) sont purgés.
 */
export async function sendToUser(userId, payload) {
  if (!userId) return { sent: 0 };
  const db = getDb();
  const subs = db.prepare('SELECT * FROM push_subscriptions WHERE user_id = ?').all(userId);
  if (!subs.length) return { sent: 0 };
  configured();

  let sent = 0;
  await Promise.all(subs.map(async (s) => {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify(payload)
      );
      sent++;
    } catch (err) {
      if (err?.statusCode === 404 || err?.statusCode === 410) {
        db.prepare('DELETE FROM push_subscriptions WHERE id = ?').run(s.id);
      }
    }
  }));
  return { sent };
}

const MESSAGES = {
  AFFECTATION: (t) => ({
    title: 'Nouveau ticket affecté',
    body: `${TICKET_TYPES[t.type]?.short || t.type} · ${t.client_name || 'Client'} — ${t.address || ''}`.trim(),
  }),
  REJET: (t, extra) => ({
    title: 'Ticket à refaire',
    body: `${t.reference} — ${extra || 'preuves insuffisantes'}`,
  }),
  REPLANIFICATION: (t) => ({
    title: 'Ticket replanifié',
    body: `${t.reference}${t.rdv_date ? ` — nouveau RDV : ${t.rdv_date}` : ''}`,
  }),
};

// Notifie l'équipe concernée par un évènement de ticket, sans bloquer l'appel
export function notifyTicketEvent(kind, ticketId, targetUserId, extra) {
  if (!targetUserId || !MESSAGES[kind]) return;
  try {
    const ticket = getDb().prepare('SELECT * FROM tickets WHERE id = ?').get(ticketId);
    if (!ticket) return;
    const { title, body } = MESSAGES[kind](ticket, extra);
    void sendToUser(targetUserId, { title, body, url: `/tech/tickets/${ticketId}`, tag: `ticket-${ticketId}` });
  } catch {
    // notification best-effort
  }
}
