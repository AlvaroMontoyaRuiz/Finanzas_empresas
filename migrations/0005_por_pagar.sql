-- Supplier bills paid with abonos (Por pagar). Stored in pasivos with tipo = 'proveedor'.
-- The app applies this by itself on the first request (schema.js → migrate); reference only.
ALTER TABLE pasivos ADD COLUMN tipo TEXT NOT NULL DEFAULT 'deuda';
ALTER TABLE pasivos ADD COLUMN factura TEXT;
CREATE INDEX IF NOT EXISTS idx_pas_tipo ON pasivos(tipo, empresa_id);
