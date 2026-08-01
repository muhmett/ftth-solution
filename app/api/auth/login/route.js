import bcrypt from 'bcryptjs';
import { getDb } from '@/lib/db';
import { signSession, setSessionCookie, apiHandler } from '@/lib/auth';

export const POST = apiHandler(async (req) => {
  const { phone, password } = await req.json();
  if (!phone || !password) {
    return Response.json({ error: 'Téléphone et mot de passe requis' }, { status: 400 });
  }
  const user = getDb().prepare(`
    SELECT u.* FROM users u JOIN organizations o ON o.id = u.org_id
    WHERE u.phone = ? AND u.active = 1 AND o.active = 1`).get(phone.trim());
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return Response.json({ error: 'Identifiants incorrects' }, { status: 401 });
  }
  setSessionCookie(signSession(user));
  return Response.json({ user: { id: user.id, name: user.name, role: user.role } });
});
