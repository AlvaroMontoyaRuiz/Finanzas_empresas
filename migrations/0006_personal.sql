-- Personal income/expenses of the owner (not part of any business). The app creates this table by itself; reference only.
CREATE TABLE IF NOT EXISTS personales (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tipo TEXT NOT NULL CHECK (tipo IN ('ingreso','gasto')),
  fecha TEXT NOT NULL, categoria TEXT NOT NULL, concepto TEXT NOT NULL,
  monto REAL NOT NULL CHECK (monto > 0), medio_pago TEXT, nota TEXT,
  created_by INTEGER REFERENCES users(id), created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_per_fecha ON personales(fecha);
