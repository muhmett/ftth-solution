import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import { getDb } from './db';

const SECRET = process.env.JWT_SECRET || 'percer-dev-secret-change-in-production';
const COOKIE_NAME = 'percer_session';

export function signSession(user) {
  return jwt.sign(
    { uid: user.id, role: user.role, name: user.name },
    SECRET,
    { expiresIn: '7d' }
  );
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

// Retourne l'utilisateur connecté (frais depuis la DB) ou null
export function getSessionUser() {
  const token = cookies().get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const payload = jwt.verify(token, SECRET);
    const user = getDb()
      .prepare('SELECT id, name, phone, role, zone, active FROM users WHERE id = ? AND active = 1')
      .get(payload.uid);
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
