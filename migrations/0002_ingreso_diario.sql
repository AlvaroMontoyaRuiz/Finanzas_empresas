-- Carnicería records only the total of each day (Efectivo / Nequi / Desposte).
-- The app applies this by itself on the first request (functions/_lib/schema.js → migrate).
-- Only run it by hand if you prefer the command line (it fails harmlessly if the column already exists).
ALTER TABLE empresas ADD COLUMN ingreso_diario INTEGER NOT NULL DEFAULT 0;
UPDATE empresas SET ingreso_diario = 1, cobra_pendientes = 1 WHERE slug = 'carniceria';
