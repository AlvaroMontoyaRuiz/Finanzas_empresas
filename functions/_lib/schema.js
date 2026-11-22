// The app creates its own database tables.
//
// Runs once per server instance, on the first API request. Every statement is
// "IF NOT EXISTS" / "INSERT OR IGNORE", so it is safe on a brand-new database,
// on an existing one, and when two requests arrive at the same moment.
// The same SQL lives in migrations/0001_init.sql for people who prefer the command line.

export const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS users (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     username TEXT NOT NULL UNIQUE,
     password_hash TEXT NOT NULL,
     salt TEXT NOT NULL,
     role TEXT NOT NULL CHECK (role IN ('admin','usuario')),
     display_name TEXT,
     created_at TEXT NOT NULL DEFAULT (datetime('now')))`,

  `CREATE TABLE IF NOT EXISTS sessions (
     token TEXT PRIMARY KEY,
     user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     expires_at TEXT NOT NULL,
     created_at TEXT NOT NULL DEFAULT (datetime('now')))`,

  // The 4 businesses. cobra_pendientes = its sales can stay "pendiente por cobrar" (Carnicería).
  `CREATE TABLE IF NOT EXISTS empresas (
     id INTEGER PRIMARY KEY,
     slug TEXT NOT NULL UNIQUE,
     nombre TEXT NOT NULL,
     color TEXT NOT NULL,
     cobra_pendientes INTEGER NOT NULL DEFAULT 0,
     orden INTEGER NOT NULL DEFAULT 0)`,

  `INSERT OR IGNORE INTO empresas (id, slug, nombre, color, cobra_pendientes, orden) VALUES
     (1, 'finca', 'Finca', '#1F7A4D', 0, 1),
     (2, 'carniceria', 'Carnicería', '#C94F7C', 1, 2),
     (3, 'camion', 'Camión', '#2A78D6', 0, 3),
     (4, 'palmiste', 'Palmiste', '#C77A0A', 0, 4)`,

  // Income. total = cantidad × precio_unitario (pesos colombianos).
  `CREATE TABLE IF NOT EXISTS ingresos (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     empresa_id INTEGER NOT NULL REFERENCES empresas(id),
     fecha TEXT NOT NULL,
     cliente TEXT NOT NULL,
     concepto TEXT NOT NULL,
     cantidad REAL NOT NULL CHECK (cantidad > 0),
     unidad TEXT,
     precio_unitario REAL NOT NULL CHECK (precio_unitario >= 0),
     total REAL NOT NULL,
     medio_pago TEXT,
     estado TEXT NOT NULL DEFAULT 'pagado' CHECK (estado IN ('pagado','pendiente')),
     fecha_vencimiento TEXT,
     fecha_pago TEXT,
     nota TEXT,
     created_by INTEGER REFERENCES users(id),
     created_at TEXT NOT NULL DEFAULT (datetime('now')),
     updated_at TEXT)`,
  `CREATE INDEX IF NOT EXISTS idx_ing_fecha ON ingresos(fecha)`,
  `CREATE INDEX IF NOT EXISTS idx_ing_empresa ON ingresos(empresa_id, fecha)`,
  `CREATE INDEX IF NOT EXISTS idx_ing_estado ON ingresos(estado)`,

  // Expenses. The price may be typed with or without IVA; base, iva and total are always stored.
  `CREATE TABLE IF NOT EXISTS gastos (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     empresa_id INTEGER NOT NULL REFERENCES empresas(id),
     fecha TEXT NOT NULL,
     proveedor TEXT NOT NULL,
     nit TEXT,
     factura TEXT,
     categoria TEXT NOT NULL,
     concepto TEXT NOT NULL,
     cantidad REAL NOT NULL CHECK (cantidad > 0),
     unidad TEXT,
     precio_unitario REAL NOT NULL CHECK (precio_unitario >= 0),
     precio_incluye_iva INTEGER NOT NULL DEFAULT 0,
     iva_tarifa REAL NOT NULL DEFAULT 0,
     base REAL NOT NULL,
     iva REAL NOT NULL,
     total REAL NOT NULL,
     medio_pago TEXT,
     nota TEXT,
     created_by INTEGER REFERENCES users(id),
     created_at TEXT NOT NULL DEFAULT (datetime('now')),
     updated_at TEXT)`,
  `CREATE INDEX IF NOT EXISTS idx_gas_fecha ON gastos(fecha)`,
  `CREATE INDEX IF NOT EXISTS idx_gas_empresa ON gastos(empresa_id, fecha)`,

  // Balance: debts the owner has with people (pasivos) and their payments, and assets entered by hand.
  `CREATE TABLE IF NOT EXISTS pasivos (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     empresa_id INTEGER REFERENCES empresas(id),
     fecha TEXT NOT NULL,
     acreedor TEXT NOT NULL,
     concepto TEXT NOT NULL,
     monto REAL NOT NULL CHECK (monto > 0),
     fecha_vencimiento TEXT,
     nota TEXT,
     created_by INTEGER REFERENCES users(id),
     created_at TEXT NOT NULL DEFAULT (datetime('now')),
     updated_at TEXT)`,
  `CREATE INDEX IF NOT EXISTS idx_pas_acreedor ON pasivos(acreedor)`,

  `CREATE TABLE IF NOT EXISTS pasivo_pagos (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     pasivo_id INTEGER NOT NULL REFERENCES pasivos(id) ON DELETE CASCADE,
     fecha TEXT NOT NULL,
     monto REAL NOT NULL CHECK (monto > 0),
     nota TEXT,
     created_by INTEGER REFERENCES users(id),
     created_at TEXT NOT NULL DEFAULT (datetime('now')))`,
  `CREATE INDEX IF NOT EXISTS idx_pagos_pasivo ON pasivo_pagos(pasivo_id)`,

  `CREATE TABLE IF NOT EXISTS activos (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     empresa_id INTEGER REFERENCES empresas(id),
     fecha TEXT NOT NULL,
     tipo TEXT NOT NULL,
     descripcion TEXT NOT NULL,
     valor REAL NOT NULL CHECK (valor >= 0),
     nota TEXT,
     created_by INTEGER REFERENCES users(id),
     created_at TEXT NOT NULL DEFAULT (datetime('now')),
     updated_at TEXT)`,

  `CREATE TABLE IF NOT EXISTS deletion_log (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     table_name TEXT NOT NULL,
     record_id INTEGER NOT NULL,
     payload_json TEXT NOT NULL,
     deleted_by INTEGER REFERENCES users(id),
     reason TEXT,
     deleted_at TEXT NOT NULL DEFAULT (datetime('now')))`,
];

// Changes made after the first release. D1 has no "ADD COLUMN IF NOT EXISTS", so each one
// checks first. Safe on new and old databases, and when two requests arrive together.
async function migrate(env) {
  const cols = (await env.DB.prepare(`PRAGMA table_info(empresas)`).all()).results || [];
  if (!cols.some((c) => c.name === 'ingreso_diario')) {
    // ingreso_diario = 1: the company only records the total of each day (no client, quantity or unit price)
    try {
      await env.DB.prepare(`ALTER TABLE empresas ADD COLUMN ingreso_diario INTEGER NOT NULL DEFAULT 0`).run();
    } catch (e) {
      if (!/duplicate column/i.test(String(e && e.message ? e.message : e))) throw e;
    }
    await env.DB.prepare(`UPDATE empresas SET ingreso_diario = 1, cobra_pendientes = 1 WHERE slug = 'carniceria'`).run();
  }

  // abono_efectivo: part of a desposte that was paid in cash on the day. What is still owed = total − abono_efectivo.
  const ing = (await env.DB.prepare(`PRAGMA table_info(ingresos)`).all()).results || [];
  if (!ing.some((c) => c.name === 'abono_efectivo')) {
    try {
      await env.DB.prepare(`ALTER TABLE ingresos ADD COLUMN abono_efectivo REAL NOT NULL DEFAULT 0`).run();
    } catch (e) {
      if (!/duplicate column/i.test(String(e && e.message ? e.message : e))) throw e;
    }
  }
}

let ready = false;

export async function ensureSchema(env) {
  if (ready) return;
  await env.DB.batch(SCHEMA.map((s) => env.DB.prepare(s)));
  await migrate(env);
  ready = true;
}
