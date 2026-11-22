-- Despostes: part paid in cash at the time (the rest stays por cobrar) + Balance tables.
-- The app applies this by itself on the first request (functions/_lib/schema.js → migrate).
-- Only run it by hand if you prefer the command line (the ALTER fails harmlessly if the column already exists).
ALTER TABLE ingresos ADD COLUMN abono_efectivo REAL NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS pasivos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  empresa_id INTEGER REFERENCES empresas(id),
  fecha TEXT NOT NULL, acreedor TEXT NOT NULL, concepto TEXT NOT NULL,
  monto REAL NOT NULL CHECK (monto > 0), fecha_vencimiento TEXT, nota TEXT,
  created_by INTEGER, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT
);
CREATE TABLE IF NOT EXISTS pasivo_pagos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pasivo_id INTEGER NOT NULL REFERENCES pasivos(id) ON DELETE CASCADE,
  fecha TEXT NOT NULL, monto REAL NOT NULL CHECK (monto > 0), nota TEXT,
  created_by INTEGER, created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS activos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  empresa_id INTEGER REFERENCES empresas(id),
  fecha TEXT NOT NULL, tipo TEXT NOT NULL, descripcion TEXT NOT NULL,
  valor REAL NOT NULL CHECK (valor >= 0), nota TEXT,
  created_by INTEGER, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT
);
