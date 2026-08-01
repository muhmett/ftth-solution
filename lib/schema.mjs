// Schéma SQL partagé entre l'application et le script de seed.
export const ORG_SCHEMA = `
  CREATE TABLE IF NOT EXISTS organizations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    type TEXT NOT NULL CHECK (type IN ('DONNEUR_ORDRE','SOUS_TRAITANT')),
    contact TEXT DEFAULT '',
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`;

// Un compte "équipe" représente un binôme sur le terrain : un seul login,
// deux intervenants nommés dans member1 / member2.
export const usersTable = (name = 'users') => `
  CREATE TABLE IF NOT EXISTS ${name} (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    org_id INTEGER NOT NULL REFERENCES organizations(id),
    name TEXT NOT NULL,
    phone TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('PERCER_ADMIN','PERCER_COORD','ST_COORD','EQUIPE')),
    member1 TEXT DEFAULT '',
    member2 TEXT DEFAULT '',
    zone TEXT DEFAULT '',
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`;

// org_id = sous-traitant détenteur du ticket (NULL tant qu'il est chez Percer)
export const ticketsTable = (name = 'tickets') => `
  CREATE TABLE IF NOT EXISTS ${name} (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    reference TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('FTTH','PARTAGE_IN','PARTAGE_OUT','SAV')),
    status TEXT NOT NULL DEFAULT 'NOUVEAU'
      CHECK (status IN ('NOUVEAU','DISPATCHE','AFFECTE','EN_COURS','REALISE','VALIDE_ST','VALIDE','BLOQUE','ANNULE')),
    org_id INTEGER REFERENCES organizations(id),
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
    dispatched_at TEXT,
    realized_at TEXT,
    validated_st_at TEXT,
    validated_st_by INTEGER REFERENCES users(id),
    validated_at TEXT,
    validated_by INTEGER REFERENCES users(id),
    created_by INTEGER REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`;

const SIDE_TABLES = `
  CREATE TABLE IF NOT EXISTS import_batches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filename TEXT NOT NULL,
    total INTEGER NOT NULL DEFAULT 0,
    created_by INTEGER REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

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
`;

const INDEXES = `
  CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
  CREATE INDEX IF NOT EXISTS idx_tickets_assigned ON tickets(assigned_to);
  CREATE INDEX IF NOT EXISTS idx_tickets_type ON tickets(type);
  CREATE INDEX IF NOT EXISTS idx_tickets_org ON tickets(org_id);
  CREATE INDEX IF NOT EXISTS idx_users_org ON users(org_id);
`;

// Schéma complet, utilisé aussi par le script de seed
export const CORE_SCHEMA = SIDE_TABLES + usersTable() + ticketsTable() + INDEXES;
