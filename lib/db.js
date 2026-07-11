import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

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
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('ADMIN','COORDINATEUR','TECHNICIEN')),
      zone TEXT DEFAULT '',
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS import_batches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL,
      total INTEGER NOT NULL DEFAULT 0,
      created_by INTEGER REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS tickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reference TEXT NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('FTTH','PARTAGE_IN','PARTAGE_OUT','SAV')),
      status TEXT NOT NULL DEFAULT 'NOUVEAU'
        CHECK (status IN ('NOUVEAU','AFFECTE','EN_COURS','REALISE','VALIDE','BLOQUE','ANNULE')),
      client_name TEXT DEFAULT '',
      client_phone TEXT DEFAULT '',
      address TEXT DEFAULT '',
      city TEXT DEFAULT '',
      zone TEXT DEFAULT '',
      pbo TEXT DEFAULT '',
      pto TEXT DEFAULT '',
      nd TEXT DEFAULT '',
      operator TEXT DEFAULT '',
      rdv_date TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      extra TEXT DEFAULT '{}',
      assigned_to INTEGER REFERENCES users(id),
      import_batch_id INTEGER REFERENCES import_batches(id),
      power_db REAL,
      router_sn TEXT DEFAULT '',
      blockage_reason TEXT DEFAULT '',
      blockage_comment TEXT DEFAULT '',
      blocked_at TEXT,
      realized_at TEXT,
      validated_at TEXT,
      validated_by INTEGER REFERENCES users(id),
      created_by INTEGER REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
    CREATE INDEX IF NOT EXISTS idx_tickets_assigned ON tickets(assigned_to);
    CREATE INDEX IF NOT EXISTS idx_tickets_type ON tickets(type);

    CREATE TABLE IF NOT EXISTS ticket_photos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
      photo_type TEXT NOT NULL,
      file_path TEXT NOT NULL,
      uploaded_by INTEGER REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS ticket_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
      action TEXT NOT NULL,
      detail TEXT DEFAULT '',
      user_id INTEGER REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

export function addHistory(ticketId, action, detail, userId) {
  getDb()
    .prepare('INSERT INTO ticket_history (ticket_id, action, detail, user_id) VALUES (?,?,?,?)')
    .run(ticketId, action, detail || '', userId || null);
}

export function touchTicket(ticketId) {
  getDb().prepare("UPDATE tickets SET updated_at = datetime('now') WHERE id = ?").run(ticketId);
}
