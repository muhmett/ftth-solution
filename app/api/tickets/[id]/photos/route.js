import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { getDb, getUploadDir, addHistory, touchTicket } from '@/lib/db';
import { requireUser, apiHandler, assertTicketAccess, isCoord } from '@/lib/auth';
import { PHOTO_TYPES } from '@/lib/constants';

const MAX_SIZE = 15 * 1024 * 1024; // 15 Mo
const ALLOWED_EXT = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };

// Upload d'une photo de preuve (multipart/form-data : file, photo_type)
export const POST = apiHandler(async (req, { params }) => {
  const user = requireUser();
  const id = Number(params.id);
  const db = getDb();
  const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(id);
  if (!ticket) return Response.json({ error: 'Ticket introuvable' }, { status: 404 });
  assertTicketAccess(user, ticket);

  const form = await req.formData();
  const file = form.get('file');
  const photoType = form.get('photo_type');
  if (!file || typeof file === 'string') return Response.json({ error: 'Fichier manquant' }, { status: 400 });
  if (!PHOTO_TYPES[photoType]) return Response.json({ error: 'Type de photo invalide' }, { status: 400 });
  const ext = ALLOWED_EXT[file.type];
  if (!ext) return Response.json({ error: 'Format non supporté (JPEG, PNG ou WebP)' }, { status: 400 });
  if (file.size > MAX_SIZE) return Response.json({ error: 'Fichier trop volumineux (max 15 Mo)' }, { status: 400 });

  const name = `t${id}_${photoType}_${crypto.randomBytes(6).toString('hex')}${ext}`;
  const dir = path.join(getUploadDir(), String(id));
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, name), Buffer.from(await file.arrayBuffer()));

  const relPath = `${id}/${name}`;
  const info = db.prepare(
    'INSERT INTO ticket_photos (ticket_id, photo_type, file_path, uploaded_by) VALUES (?,?,?,?)'
  ).run(id, photoType, relPath, user.id);
  addHistory(id, 'PHOTO', `Photo ajoutée : ${PHOTO_TYPES[photoType]}`, user.id);
  touchTicket(id);
  return Response.json({ id: info.lastInsertRowid, file_path: relPath, photo_type: photoType }, { status: 201 });
});

// Suppression d'une photo : ?photo_id=..
export const DELETE = apiHandler(async (req, { params }) => {
  const user = requireUser();
  const id = Number(params.id);
  const photoId = Number(new URL(req.url).searchParams.get('photo_id'));
  const db = getDb();
  const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(id);
  if (!ticket) return Response.json({ error: 'Ticket introuvable' }, { status: 404 });
  assertTicketAccess(user, ticket);

  const photo = db.prepare('SELECT * FROM ticket_photos WHERE id = ? AND ticket_id = ?').get(photoId, id);
  if (!photo) return Response.json({ error: 'Photo introuvable' }, { status: 404 });
  // Une équipe ne peut retirer une preuve qu'avant le contrôle qualité
  if (!isCoord(user) && ['VALIDE_ST', 'VALIDE', 'ANNULE'].includes(ticket.status)) {
    return Response.json({ error: 'Ticket déjà contrôlé' }, { status: 403 });
  }
  db.prepare('DELETE FROM ticket_photos WHERE id = ?').run(photoId);
  try { fs.unlinkSync(path.join(getUploadDir(), photo.file_path)); } catch {}
  return Response.json({ ok: true });
});
