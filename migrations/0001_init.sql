-- Same tables the app creates by itself on first use (functions/_lib/schema.js).
-- Only needed if you prefer to create them from the command line.

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin','usuario')),
  display_name TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')));

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')));

CREATE TABLE IF NOT EXISTS empresas (
  id INTEGER PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  nombre TEXT NOT NULL,
  color TEXT NOT NULL,
  cobra_pendientes INTEGER NOT NULL DEFAULT 0,
  orden INTEGER NOT NULL DEFAULT 0);

INSERT OR IGNORE INTO empresas (id, slug, nombre, color, cobra_pendientes, orden) VALUES
  (1, 'finca', 'Finca', '#1F7A4D', 0, 1),
  (2, 'carniceria', 'Carnicería', '#C94F7C', 1, 2),
  (3, 'camion', 'Camión', '#2A78D6', 0, 3),
  (4, 'palmiste', 'Palmiste', '#C77A0A', 0, 4);

CREATE TABLE IF NOT EXISTS ingresos (
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
  updated_at TEXT);

CREATE INDEX IF NOT EXISTS idx_ing_fecha ON ingresos(fecha);

CREATE INDEX IF NOT EXISTS idx_ing_empresa ON ingresos(empresa_id, fecha);

CREATE INDEX IF NOT EXISTS idx_ing_estado ON ingresos(estado);

CREATE TABLE IF NOT EXISTS gastos (
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
  updated_at TEXT);

CREATE INDEX IF NOT EXISTS idx_gas_fecha ON gastos(fecha);

CREATE INDEX IF NOT EXISTS idx_gas_empresa ON gastos(empresa_id, fecha);

CREATE TABLE IF NOT EXISTS deletion_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  table_name TEXT NOT NULL,
  record_id INTEGER NOT NULL,
  payload_json TEXT NOT NULL,
  deleted_by INTEGER REFERENCES users(id),
  reason TEXT,
  deleted_at TEXT NOT NULL DEFAULT (datetime('now')));
