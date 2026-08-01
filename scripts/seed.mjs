// Initialisation de la base : sociétés, comptes et tickets de démonstration.
// Usage : npm run seed
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import path from 'path';
import fs from 'fs';
import { ORG_SCHEMA, CORE_SCHEMA } from '../lib/schema.mjs';

const DATA_DIR = path.join(process.cwd(), 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });
const db = new Database(path.join(DATA_DIR, 'percer.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.exec(ORG_SCHEMA);
db.exec(CORE_SCHEMA);

if (db.prepare('SELECT COUNT(*) AS n FROM users').get().n > 0) {
  console.log('Base déjà initialisée — aucun changement.');
  process.exit(0);
}

const hash = (p) => bcrypt.hashSync(p, 10);
const addOrg = db.prepare('INSERT INTO organizations (name, type, contact) VALUES (?,?,?)');
const addUser = db.prepare(`
  INSERT INTO users (org_id, name, phone, password_hash, role, zone, member1, member2)
  VALUES (?,?,?,?,?,?,?,?)`);
const addTicket = db.prepare(`
  INSERT INTO tickets (reference, type, status, org_id, client_name, client_phone, address, city,
    zone, pbo, nd, operator, rdv_date, assigned_to, dispatched_at, created_by)
  VALUES (@reference,@type,@status,@org_id,@client_name,@client_phone,@address,@city,@zone,@pbo,
    @nd,@operator,@rdv_date,@assigned_to,@dispatched_at,@created_by)`);
const addHistory = db.prepare(
  'INSERT INTO ticket_history (ticket_id, action, detail, user_id) VALUES (?,?,?,?)');
const addTerms = db.prepare(`
  INSERT INTO contract_terms (org_id, ticket_type, unit_price, sla_hours, penalty_rate)
  VALUES (?,?,?,?,?)`);

// --- Sociétés ---
const percerOrg = addOrg.run('Percer', 'DONNEUR_ORDRE', 'Direction production FTTH').lastInsertRowid;
const ayline = addOrg.run('Ayline', 'SOUS_TRAITANT', 'M. Alami — 0661000001').lastInsertRowid;
const sotra = addOrg.run('Sotra Fibre', 'SOUS_TRAITANT', 'M. Bennis — 0661000002').lastInsertRowid;

// --- Comptes ---
const admin = addUser.run(percerOrg, 'Administrateur Percer', '0600000000', hash('admin123'), 'PERCER_ADMIN', 'National', '', '').lastInsertRowid;
addUser.run(percerOrg, 'Coordinateur Percer', '0611111111', hash('coord123'), 'PERCER_COORD', 'Casablanca', '', '');

addUser.run(ayline, 'Coordinateur Ayline', '0622222222', hash('coord123'), 'ST_COORD', 'Casablanca', '', '');
const eq1 = addUser.run(ayline, 'Équipe 1 — Maârif', '0630000001', hash('equipe123'), 'EQUIPE', 'Casablanca — Maârif', 'Youssef Alami', 'Karim Bennani').lastInsertRowid;
const eq2 = addUser.run(ayline, 'Équipe 2 — Sidi Maârouf', '0630000002', hash('equipe123'), 'EQUIPE', 'Casablanca — Sidi Maârouf', 'Hassan Chraibi', 'Omar Tazi').lastInsertRowid;
addUser.run(ayline, 'Équipe 3 — Aïn Sebaâ', '0630000003', hash('equipe123'), 'EQUIPE', 'Casablanca — Aïn Sebaâ', 'Said Idrissi', 'Mehdi Naciri');

addUser.run(sotra, 'Coordinateur Sotra', '0644444444', hash('coord123'), 'ST_COORD', 'Rabat', '', '');
const eq4 = addUser.run(sotra, 'Équipe 1 — Agdal', '0640000001', hash('equipe123'), 'EQUIPE', 'Rabat — Agdal', 'Anas Berrada', 'Younes Fassi').lastInsertRowid;

// --- Conditions contractuelles (montants illustratifs, en MAD) ---
const TERMS = {
  // [prix unitaire, délai en heures, retenue en % si hors délai]
  [ayline]: { FTTH: [180, 72, 10], PARTAGE_IN: [150, 72, 10], PARTAGE_OUT: [120, 72, 10], SAV: [90, 24, 20] },
  [sotra]: { FTTH: [170, 72, 10], PARTAGE_IN: [140, 72, 10], PARTAGE_OUT: [110, 72, 10], SAV: [85, 24, 15] },
};
for (const [orgId, byType] of Object.entries(TERMS)) {
  for (const [type, [price, sla, penalty]] of Object.entries(byType)) {
    addTerms.run(Number(orgId), type, price, sla, penalty);
  }
}

// --- Tickets ---
const T = (o) => ({
  status: 'NOUVEAU', org_id: null, client_phone: '', address: '', city: 'Casablanca', zone: '',
  pbo: '', nd: '', operator: 'Orange', rdv_date: '', assigned_to: null, created_by: admin, ...o,
});

const demo = [
  // En attente de répartition chez Percer
  T({ reference: 'ORD-2026-10010', type: 'FTTH', client_name: 'Rachid Benjelloun', client_phone: '0663456789', address: '45 Bd Zerktouni', zone: 'Gauthier', pbo: 'PBO-GA-007', nd: 'ND5522012', rdv_date: '2026-08-05 09:00' }),
  T({ reference: 'ORD-2026-10011', type: 'PARTAGE_OUT', client_name: 'Hassan Chraibi', client_phone: '0665678901', address: 'Lot Yasmine 22', zone: 'Californie', pbo: 'PBO-CA-055', nd: 'ND5522013', operator: 'inwi', rdv_date: '2026-08-05 11:00' }),
  T({ reference: 'ORD-2026-10012', type: 'FTTH', client_name: 'Nadia Squalli', client_phone: '0667788990', address: '8 Rue Al Yamama', zone: 'Bourgogne', pbo: 'PBO-BO-019', nd: 'ND5522014', rdv_date: '2026-08-06 10:00' }),
  T({ reference: 'SAV-2026-20010', type: 'SAV', client_name: 'Driss Lamrani', client_phone: '0668899001', address: '17 Rue Jenner', zone: 'Belvédère', pbo: 'PBO-BE-101', nd: 'ND5510055', rdv_date: '2026-08-05 15:00' }),

  // Confiés à Ayline
  T({ reference: 'ORD-2026-10001', type: 'FTTH', status: 'AFFECTE', org_id: ayline, assigned_to: eq1, client_name: 'Mohammed Tazi', client_phone: '0661234567', address: '12 Rue Ibnou Mounir, Maârif', zone: 'Maârif', pbo: 'PBO-MA-042', nd: 'ND5522010', rdv_date: '2026-08-04 10:00' }),
  T({ reference: 'ORD-2026-10002', type: 'PARTAGE_IN', status: 'AFFECTE', org_id: ayline, assigned_to: eq2, client_name: 'Fatima Zahra El Idrissi', client_phone: '0662345678', address: 'Résidence Al Manar, Apt 8', zone: 'Sidi Maârouf', pbo: 'PBO-SM-118', nd: 'ND5522011', operator: 'IAM', rdv_date: '2026-08-04 14:30' }),
  T({ reference: 'ORD-2026-10003', type: 'FTTH', status: 'DISPATCHE', org_id: ayline, client_name: 'Samira Ouazzani', client_phone: '0664455667', address: '3 Rue Ahmed Charci', zone: 'Maârif', pbo: 'PBO-MA-088', nd: 'ND5522015', rdv_date: '2026-08-06 09:30' }),
  T({ reference: 'SAV-2026-20001', type: 'SAV', status: 'BLOQUE', org_id: ayline, assigned_to: eq1, client_name: 'Amina Berrada', client_phone: '0664567890', address: '3 Rue Oued Ziz', city: 'Rabat', zone: 'Agdal', pbo: 'PBO-AG-231', nd: 'ND5510044', rdv_date: '2026-08-03 16:00' }),
  T({ reference: 'ORD-2026-10004', type: 'FTTH', status: 'REALISE', org_id: ayline, assigned_to: eq2, client_name: 'Khalid Sefrioui', client_phone: '0669900112', address: '55 Bd Ghandi', zone: 'Sidi Maârouf', pbo: 'PBO-SM-064', nd: 'ND5522016', rdv_date: '2026-08-03 09:00' }),
  T({ reference: 'ORD-2026-10005', type: 'PARTAGE_IN', status: 'VALIDE_ST', org_id: ayline, assigned_to: eq1, client_name: 'Leila Cherkaoui', client_phone: '0661122334', address: '21 Rue Nolly', zone: 'Maârif', pbo: 'PBO-MA-012', nd: 'ND5522017', rdv_date: '2026-08-02 11:00' }),

  // Confiés à Sotra Fibre
  T({ reference: 'ORD-2026-10006', type: 'FTTH', status: 'AFFECTE', org_id: sotra, assigned_to: eq4, client_name: 'Omar Benslimane', client_phone: '0662233445', address: '9 Avenue Fal Ould Oumeir', city: 'Rabat', zone: 'Agdal', pbo: 'PBO-AG-045', nd: 'ND5533001', rdv_date: '2026-08-04 10:00' }),
  T({ reference: 'ORD-2026-10007', type: 'FTTH', status: 'DISPATCHE', org_id: sotra, client_name: 'Hind Alaoui', client_phone: '0663344556', address: '14 Rue Tanger', city: 'Rabat', zone: 'Hassan', pbo: 'PBO-HA-076', nd: 'ND5533002', rdv_date: '2026-08-06 14:00' }),
];

const insert = db.transaction(() => {
  const markDispatched = db.prepare(
    "UPDATE tickets SET dispatched_at = datetime('now','-2 days') WHERE id = ?");
  for (const t of demo) {
    const id = addTicket.run({ ...t, dispatched_at: null }).lastInsertRowid;
    addHistory.run(id, 'CREATION', 'Ticket de démonstration', admin);
    if (t.org_id) {
      markDispatched.run(id);
      addHistory.run(id, 'REPARTITION', 'Réparti (démo)', admin);
    }
    if (t.assigned_to) addHistory.run(id, 'AFFECTATION', 'Affecté (démo)', admin);
  }

  // Un blocage et un contrôle déjà en cours, pour que le démo soit parlant
  db.prepare(`UPDATE tickets SET blockage_reason = 'PBO_SATURE',
    blockage_comment = 'PBO plein, aucune position libre', blocked_at = datetime('now','-3 days')
    WHERE reference = 'SAV-2026-20001'`).run();
  db.prepare(`UPDATE tickets SET power_db = -18.4, router_sn = 'SN-AY-88213',
    realized_at = datetime('now','-1 day') WHERE reference = 'ORD-2026-10004'`).run();
  db.prepare(`UPDATE tickets SET power_db = -19.7, router_sn = 'SN-AY-88147',
    realized_at = datetime('now','-2 days'), validated_st_at = datetime('now','-1 day'),
    validated_st_by = (SELECT id FROM users WHERE phone = '0622222222')
    WHERE reference = 'ORD-2026-10005'`).run();

  // Historique facturable du mois en cours : quelques recettes déjà prononcées,
  // dont deux hors délai pour illustrer les retenues.
  const billable = [
    ['FAC-2026-0001', 'FTTH', ayline, eq1, 2, false],
    ['FAC-2026-0002', 'FTTH', ayline, eq2, 4, false],
    ['FAC-2026-0003', 'PARTAGE_IN', ayline, eq1, 6, true],
    ['FAC-2026-0004', 'SAV', ayline, eq2, 8, false],
    ['FAC-2026-0005', 'FTTH', ayline, eq1, 10, false],
    ['FAC-2026-0006', 'SAV', ayline, eq2, 12, true],
    ['FAC-2026-0007', 'FTTH', sotra, eq4, 3, false],
    ['FAC-2026-0008', 'PARTAGE_OUT', sotra, eq4, 5, false],
  ];
  for (const [reference, type, org, equipe, daysAgo, late] of billable) {
    const id = addTicket.run({
      ...T({
        reference, type, status: 'VALIDE', org_id: org, assigned_to: equipe,
        client_name: 'Client facturé', address: 'Adresse client', zone: 'Casablanca',
      }),
      dispatched_at: null,
    }).lastInsertRowid;
    // L'échéance précède la réalisation quand l'intervention est hors délai
    db.prepare(`UPDATE tickets SET
      dispatched_at = datetime('now','-${daysAgo + 3} days'),
      deadline      = datetime('now','-${daysAgo + (late ? 1 : -1)} days'),
      realized_at   = datetime('now','-${daysAgo} days'),
      validated_st_at = datetime('now','-${Math.max(0, daysAgo - 1)} days'),
      validated_at  = datetime('now','-${Math.max(0, daysAgo - 1)} days'),
      validated_by  = ${admin}, power_db = -18.9
      WHERE id = ?`).run(id);
    addHistory.run(id, 'RECETTE', 'Recette (démo)', admin);
  }

  // Échéance des tickets confiés à un sous-traitant : RDV client, sinon délai contractuel
  db.prepare(`
    UPDATE tickets SET deadline = COALESCE(
      datetime(NULLIF(rdv_date, '')),
      datetime(COALESCE(dispatched_at, created_at),
        '+' || COALESCE((SELECT sla_hours FROM contract_terms c
                         WHERE c.org_id = tickets.org_id AND c.ticket_type = tickets.type), 48) || ' hours')
    )
    WHERE org_id IS NOT NULL AND deadline IS NULL`).run();
});
insert();

console.log('✓ Base initialisée.\n');
console.log('  PERCER (donneur d\'ordre)');
console.log('    Admin           : 0600000000 / admin123');
console.log('    Coordinateur    : 0611111111 / coord123\n');
console.log('  AYLINE (sous-traitant, 3 équipes)');
console.log('    Coordinateur    : 0622222222 / coord123');
console.log('    Équipe 1 Maârif : 0630000001 / equipe123');
console.log('    Équipe 2 S.Maârouf : 0630000002 / equipe123');
console.log('    Équipe 3 Aïn Sebaâ : 0630000003 / equipe123\n');
console.log('  SOTRA FIBRE (sous-traitant, 1 équipe)');
console.log('    Coordinateur    : 0644444444 / coord123');
console.log('    Équipe 1 Agdal  : 0640000001 / equipe123\n');
console.log(`  ${demo.length} tickets de démonstration créés.`);
