import fs from 'fs';
import path from 'path';
import { getDb, getUploadDir } from '@/lib/db';
import { requireUser, apiHandler, assertTicketAccess } from '@/lib/auth';

const MIME = { '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };

// Sert une photo de preuve. L'accès suit la portée du ticket : une société ne
// peut pas lire les preuves d'une autre.
export const GET = apiHandler(async (req, { params }) => {
  const user = requireUser();
  const rel = params.path.join('/');
  const db = getDb();
  const photo = db.prepare('SELECT * FROM ticket_photos WHERE file_path = ?').get(rel);
  if (!photo) return Response.json({ error: 'Introuvable' }, { status: 404 });
  const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(photo.ticket_id);
  if (!ticket) return Response.json({ error: 'Introuvable' }, { status: 404 });
  assertTicketAccess(user, ticket);

  const full = path.normalize(path.join(getUploadDir(), rel));
  if (!full.startsWith(getUploadDir()) || !fs.existsSync(full)) {
    return Response.json({ error: 'Introuvable' }, { status: 404 });
  }
  return new Response(fs.readFileSync(full), {
    headers: {
      'Content-Type': MIME[path.extname(full)] || 'application/octet-stream',
      'Cache-Control': 'private, max-age=86400',
    },
  });
});
