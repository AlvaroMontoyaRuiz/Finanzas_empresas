-- Fruver records the day's Efectivo and Nequi (like Carnicería, without despostes).
-- The app does this once by itself on the first request (schema.js); reference only.
UPDATE empresas SET ingreso_diario = 1 WHERE slug = 'fruver';
