import fs from 'fs';
import path from 'path';
import { getUploadDir } from '@/lib/db';
import { requireUser, apiHandler } from '@/lib/auth';

const MIME = { '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };

// Sert les photos uploadées (authentification requise)
export const GET = apiHandler(async (req, { params }) => {
  requireUser();
  const rel = params.path.join('/');
  const full = path.normalize(path.join(getUploadDir(), rel));
  if (!full.startsWith(getUploadDir())) {
    return Response.json({ error: 'Chemin invalide' }, { status: 400 });
  }
  if (!fs.existsSync(full)) return Response.json({ error: 'Introuvable' }, { status: 404 });
  const buf = fs.readFileSync(full);
  return new Response(buf, {
    headers: {
      'Content-Type': MIME[path.extname(full)] || 'application/octet-stream',
      'Cache-Control': 'private, max-age=86400',
    },
  });
});
