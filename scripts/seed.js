// Initialisation de la base : compte admin + données de démonstration
// Usage : npm run seed
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(process.cwd(), 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });
const db = new Database(path.join(DATA_DIR, 'percer.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Même schéma que lib/db.js
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

const count = db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
if (count > 0) {
  console.log('Base déjà initialisée — aucun changement.');
  process.exit(0);
}

const hash = (p) => bcrypt.hashSync(p, 10);
const insertUser = db.prepare('INSERT INTO users (name, phone, password_hash, role, zone) VALUES (?,?,?,?,?)');

const admin = insertUser.run('Administrateur Percer', '0600000000', hash('admin123'), 'ADMIN', 'Casablanca').lastInsertRowid;
insertUser.run('Coordinateur Démo', '0611111111', hash('coord123'), 'COORDINATEUR', 'Casablanca');
const tech1 = insertUser.run('Youssef Alami', '0622222222', hash('tech123'), 'TECHNICIEN', 'Casablanca — Maârif').lastInsertRowid;
const tech2 = insertUser.run('Karim Bennani', '0633333333', hash('tech123'), 'TECHNICIEN', 'Casablanca — Sidi Maârouf').lastInsertRowid;

const insertTicket = db.prepare(`
  INSERT INTO tickets (reference, type, status, client_name, client_phone, address, city, zone, pbo, pto, nd, operator, rdv_date, assigned_to, created_by)
  VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
const hist = db.prepare('INSERT INTO ticket_history (ticket_id, action, detail, user_id) VALUES (?,?,?,?)');

const demo = [
  ['ORD-2026-10001', 'FTTH', 'AFFECTE', 'Mohammed Tazi', '0661234567', '12 Rue Ibnou Mounir, Maârif', 'Casablanca', 'Maârif', 'PBO-MA-042', '', 'ND5522010', 'Orange', '2026-07-12 10:00', tech1],
  ['ORD-2026-10002', 'PARTAGE_IN', 'AFFECTE', 'Fatima Zahra El Idrissi', '0662345678', 'Résidence Al Manar, Apt 8, Sidi Maârouf', 'Casablanca', 'Sidi Maârouf', 'PBO-SM-118', '', 'ND5522011', 'IAM', '2026-07-12 14:30', tech2],
  ['ORD-2026-10003', 'FTTH', 'NOUVEAU', 'Rachid Benjelloun', '0663456789', '45 Bd Zerktouni', 'Casablanca', 'Gauthier', 'PBO-GA-007', '', 'ND5522012', 'Orange', '2026-07-13 09:00', null],
  ['SAV-2026-20001', 'SAV', 'AFFECTE', 'Amina Berrada', '0664567890', '3 Rue Oued Ziz, Agdal', 'Rabat', 'Agdal', 'PBO-AG-231', 'PTO-99812', 'ND5510044', 'Orange', '2026-07-12 16:00', tech1],
  ['ORD-2026-10004', 'PARTAGE_OUT', 'NOUVEAU', 'Hassan Chraibi', '0665678901', 'Lot Yasmine 22, Californie', 'Casablanca', 'Californie', 'PBO-CA-055', '', 'ND5522013', 'inwi', '2026-07-14 11:00', null],
];
for (const t of demo) {
  const id = insertTicket.run(...t, admin).lastInsertRowid;
  hist.run(id, 'CREATION', 'Ticket de démonstration', admin);
  if (t[13]) hist.run(id, 'AFFECTATION', 'Affecté (démo)', admin);
}

console.log('✓ Base initialisée avec les comptes de démonstration :');
console.log('  Admin        : 0600000000 / admin123');
console.log('  Coordinateur : 0611111111 / coord123');
console.log('  Technicien 1 : 0622222222 / tech123');
console.log('  Technicien 2 : 0633333333 / tech123');
console.log(`  ${demo.length} tickets de démonstration créés.`);
