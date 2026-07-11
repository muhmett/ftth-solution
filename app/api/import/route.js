import * as XLSX from 'xlsx';
import { getDb, addHistory } from '@/lib/db';
import { requireUser, apiHandler } from '@/lib/auth';

// Champs cibles d'un ticket et mots-clés pour l'auto-détection des colonnes Excel
const FIELD_KEYWORDS = {
  reference: ['ref', 'référence', 'reference', 'ticket', 'num', 'n°', 'id', 'crm', 'commande'],
  nd: ['nd', 'numéro dérangement', 'login', 'ligne'],
  type: ['type', 'nature', 'activité', 'activite', 'prestation'],
  client_name: ['client', 'nom', 'abonné', 'abonne', 'prenom'],
  client_phone: ['tél', 'tel', 'gsm', 'phone', 'portable', 'contact', 'mobile'],
  address: ['adresse', 'addr', 'rue', 'localisation'],
  city: ['ville', 'commune', 'city'],
  zone: ['zone', 'secteur', 'quartier', 'plaque', 'sip'],
  pbo: ['pbo', 'pb ', 'point de branchement', 'boitier'],
  pto: ['pto', 'prise', 'dtio'],
  operator: ['opérateur', 'operateur', 'oi', 'infra'],
  rdv_date: ['rdv', 'rendez', 'date'],
  notes: ['comment', 'note', 'observation', 'remarque'],
};

function autoDetectField(header) {
  const h = String(header).toLowerCase().trim();
  for (const [field, keywords] of Object.entries(FIELD_KEYWORDS)) {
    if (keywords.some((k) => h.includes(k))) return field;
  }
  return '';
}

function detectType(value, fallback) {
  const v = String(value || '').toUpperCase().replace(/[\s-]/g, '_');
  if (v.includes('PARTAGE_IN') || v === 'P_IN' || v === 'PIN') return 'PARTAGE_IN';
  if (v.includes('PARTAGE_OUT') || v === 'P_OUT' || v === 'POUT') return 'PARTAGE_OUT';
  if (v.includes('SAV') || v.includes('DERANGEMENT') || v.includes('DÉRANGEMENT')) return 'SAV';
  if (v.includes('FTTH') || v.includes('PROD') || v.includes('RACCORD') || v.includes('INSTALL')) return 'FTTH';
  return fallback;
}

function cellToString(v) {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return v.toISOString().slice(0, 16).replace('T', ' ');
  return String(v).trim();
}

// POST multipart : file, mode=preview|commit, mapping (JSON), default_type
export const POST = apiHandler(async (req) => {
  const user = requireUser(['ADMIN', 'COORDINATEUR']);
  const form = await req.formData();
  const file = form.get('file');
  const mode = form.get('mode') || 'preview';
  const defaultType = ['FTTH', 'PARTAGE_IN', 'PARTAGE_OUT', 'SAV'].includes(form.get('default_type'))
    ? form.get('default_type') : 'FTTH';

  if (!file || typeof file === 'string') {
    return Response.json({ error: 'Fichier Excel manquant' }, { status: 400 });
  }
  const buf = Buffer.from(await file.arrayBuffer());
  let wb;
  try {
    wb = XLSX.read(buf, { type: 'buffer', cellDates: true });
  } catch {
    return Response.json({ error: 'Fichier illisible — utilisez un fichier .xlsx, .xls ou .csv' }, { status: 400 });
  }
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  if (rows.length < 2) {
    return Response.json({ error: 'Le fichier ne contient aucune ligne de données' }, { status: 400 });
  }
  const headers = rows[0].map(cellToString);
  const dataRows = rows.slice(1).filter((r) => r.some((c) => cellToString(c) !== ''));

  if (mode === 'preview') {
    const mapping = headers.map((h) => ({ header: h, field: autoDetectField(h) }));
    return Response.json({
      headers,
      mapping,
      total: dataRows.length,
      sample: dataRows.slice(0, 5).map((r) => r.map(cellToString)),
    });
  }

  // mode === 'commit'
  let mapping;
  try {
    mapping = JSON.parse(form.get('mapping') || '[]');
  } catch {
    return Response.json({ error: 'Mapping invalide' }, { status: 400 });
  }
  const colFor = {};
  mapping.forEach((m, i) => { if (m.field) colFor[m.field] = i; });
  if (colFor.reference === undefined) {
    return Response.json({ error: 'La colonne "Référence" doit être mappée' }, { status: 400 });
  }

  const db = getDb();
  const batchInfo = db.prepare('INSERT INTO import_batches (filename, total, created_by) VALUES (?,?,?)')
    .run(file.name || 'import.xlsx', dataRows.length, user.id);
  const batchId = batchInfo.lastInsertRowid;

  const get = (row, field) => (colFor[field] !== undefined ? cellToString(row[colFor[field]]) : '');
  const insert = db.prepare(`
    INSERT INTO tickets (reference, type, client_name, client_phone, address, city, zone,
      pbo, pto, nd, operator, rdv_date, notes, extra, import_batch_id, created_by)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  const existsStmt = db.prepare(
    "SELECT id FROM tickets WHERE reference = ? AND status NOT IN ('VALIDE','ANNULE')");

  let created = 0;
  let skipped = 0;
  const errors = [];
  const run = db.transaction(() => {
    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const reference = get(row, 'reference');
      if (!reference) { skipped++; errors.push(`Ligne ${i + 2} : référence vide`); continue; }
      if (existsStmt.get(reference)) { skipped++; errors.push(`Ligne ${i + 2} : ${reference} existe déjà (en cours)`); continue; }
      const type = detectType(get(row, 'type'), defaultType);
      // Colonnes non mappées conservées dans extra pour ne rien perdre
      const extra = {};
      headers.forEach((h, ci) => {
        if (!Object.values(colFor).includes(ci) && cellToString(row[ci])) extra[h] = cellToString(row[ci]);
      });
      const info = insert.run(
        reference, type, get(row, 'client_name'), get(row, 'client_phone'), get(row, 'address'),
        get(row, 'city'), get(row, 'zone'), get(row, 'pbo'), get(row, 'pto'), get(row, 'nd'),
        get(row, 'operator'), get(row, 'rdv_date'), get(row, 'notes'), JSON.stringify(extra),
        batchId, user.id
      );
      addHistory(info.lastInsertRowid, 'CREATION', `Importé depuis ${file.name || 'Excel'}`, user.id);
      created++;
    }
  });
  run();

  return Response.json({ batch_id: batchId, created, skipped, errors: errors.slice(0, 20) });
});
