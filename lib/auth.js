import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import { getDb } from './db';
import { PERCER_ROLES, COORD_ROLES } from './constants';

const SECRET = process.env.JWT_SECRET || 'percer-dev-secret-change-in-production';
const COOKIE_NAME = 'percer_session';

export function signSession(user) {
  return jwt.sign({ uid: user.id }, SECRET, { expiresIn: '7d' });
}

export function setSessionCookie(token) {
  cookies().set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 3600,
    path: '/',
  });
}

export function clearSessionCookie() {
  cookies().set(COOKIE_NAME, '', { httpOnly: true, maxAge: 0, path: '/' });
}

// Retourne l'utilisateur connecté (rôle et société relus depuis la DB) ou null
export function getSessionUser() {
  const token = cookies().get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const payload = jwt.verify(token, SECRET);
    const user = getDb().prepare(`
      SELECT u.id, u.name, u.phone, u.role, u.zone, u.active, u.org_id, u.member1, u.member2,
             o.name AS org_name, o.type AS org_type
      FROM users u JOIN organizations o ON o.id = u.org_id
      WHERE u.id = ? AND u.active = 1 AND o.active = 1`).get(payload.uid);
    return user || null;
  } catch {
    return null;
  }
}

export function requireUser(roles) {
  const user = getSessionUser();
  if (!user) {
    const err = new Error('Non authentifié');
    err.status = 401;
    throw err;
  }
  if (roles && !roles.includes(user.role)) {
    const err = new Error('Accès refusé');
    err.status = 403;
    throw err;
  }
  return user;
}

export const isPercer = (user) => PERCER_ROLES.includes(user.role);
export const isCoord = (user) => COORD_ROLES.includes(user.role);

/**
 * Portée de lecture des tickets, appliquée à TOUTES les requêtes de liste.
 * Percer voit tout ; un coordinateur ne voit que la société qui détient le
 * ticket ; une équipe ne voit que ce qui lui est affecté.
 */
export function ticketScope(user, alias = 't') {
  if (isPercer(user)) return { sql: '', vals: [] };
  if (user.role === 'ST_COORD') return { sql: `${alias}.org_id = ?`, vals: [user.org_id] };
  return { sql: `${alias}.assigned_to = ?`, vals: [user.id] };
}

// Même règle, appliquée à un ticket déjà chargé. Lève 403 si hors périmètre.
export function assertTicketAccess(user, ticket) {
  const ok = isPercer(user)
    ? true
    : user.role === 'ST_COORD'
      ? ticket.org_id === user.org_id
      : ticket.assigned_to === user.id;
  if (!ok) {
    const err = new Error('Accès refusé');
    err.status = 403;
    throw err;
  }
  return ticket;
}

// Wrapper pour les routes API : gère les erreurs d'auth proprement
export function apiHandler(fn) {
  return async (req, ctx) => {
    try {
      return await fn(req, ctx);
    } catch (err) {
      const status = err.status || 500;
      if (status === 500) console.error(err);
      return Response.json({ error: err.message || 'Erreur serveur' }, { status });
    }
  };
}
