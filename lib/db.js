import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { ORG_SCHEMA, CORE_SCHEMA, usersTable, ticketsTable } from './schema.mjs';

const DATA_DIR = path.join(process.cwd(), 'data');
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');

let db;

export function getDb() {
  if (!db) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    db = new Database(path.join(DATA_DIR, 'percer.db'));
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    migrate(db);
  }
  return db;
}

export function getUploadDir() {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  return UPLOAD_DIR;
}

function migrate(db) {
  db.exec(ORG_SCHEMA);
  const hasUsers = db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='users'").get();
  const hasOrgCol = hasUsers && db.prepare("SELECT 1 FROM pragma_table_info('users') WHERE name='org_id'").get();
  if (hasUsers && !hasOrgCol) upgradeToMultiOrg(db);
  db.exec(CORE_SCHEMA);
}

/**
 * v1 (société unique) → v2 (multi-société). Les comptes de pilotage rejoignent
 * le donneur d'ordre, les techniciens deviennent des équipes rattachées à un
 * premier sous-traitant, et leurs tickets suivent. Les tables sont reconstruites
 * (les contraintes CHECK de SQLite ne sont pas modifiables en place) ; photos et
 * historique restent attachés puisque les identifiants sont conservés.
 */
function upgradeToMultiOrg(db) {
  db.pragma('foreign_keys = OFF');
  db.transaction(() => {
    const orgId = (name, type) => {
      db.prepare('INSERT OR IGNORE INTO organizations (name, type) VALUES (?,?)').run(name, type);
      return db.prepare('SELECT id FROM organizations WHERE name = ?').get(name).id;
    };
    const percerId = orgId('Percer', 'DONNEUR_ORDRE');
    const stId = orgId('Sous-traitant 1', 'SOUS_TRAITANT');

    db.exec(usersTable('users_new'));
    db.exec(ticketsTable('tickets_new'));

    db.prepare(`
      INSERT INTO users_new (id, org_id, name, phone, password_hash, role, zone, active, created_at)
      SELECT id,
        CASE WHEN role = 'TECHNICIEN' THEN ? ELSE ? END,
        name, phone, password_hash,
        CASE role WHEN 'ADMIN' THEN 'PERCER_ADMIN' WHEN 'COORDINATEUR' THEN 'PERCER_COORD' ELSE 'EQUIPE' END,
        zone, active, created_at
      FROM users`).run(stId, percerId);

    db.prepare(`
      INSERT INTO tickets_new (id, reference, type, status, org_id, client_name, client_phone, address,
        city, zone, pbo, pto, nd, operator, rdv_date, notes, extra, assigned_to, import_batch_id,
        power_db, router_sn, blockage_reason, blockage_comment, blocked_at, realized_at,
        validated_at, validated_by, created_by, created_at, updated_at)
      SELECT id, reference, type, status,
        CASE WHEN assigned_to IS NOT NULL THEN ? ELSE NULL END,
        client_name, client_phone, address, city, zone, pbo, pto, nd, operator, rdv_date, notes,
        extra, assigned_to, import_batch_id, power_db, router_sn, blockage_reason, blockage_comment,
        blocked_at, realized_at, validated_at, validated_by, created_by, created_at, updated_at
      FROM tickets`).run(stId);

    db.exec(`
      DROP TABLE tickets;
      DROP TABLE users;
      ALTER TABLE users_new RENAME TO users;
      ALTER TABLE tickets_new RENAME TO tickets;
    `);
  })();
  db.pragma('foreign_keys = ON');
}

export function addHistory(ticketId, action, detail, userId) {
  getDb()
    .prepare('INSERT INTO ticket_history (ticket_id, action, detail, user_id) VALUES (?,?,?,?)')
    .run(ticketId, action, detail || '', userId || null);
}

export function touchTicket(ticketId) {
  getDb().prepare("UPDATE tickets SET updated_at = datetime('now') WHERE id = ?").run(ticketId);
}
