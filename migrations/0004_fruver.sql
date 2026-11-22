-- New company: Fruver (fruits and vegetables). The app adds it by itself on the first request (schema.js);
-- this file is only a reference if you prefer the command line (safe to run twice).
INSERT OR IGNORE INTO empresas (id, slug, nombre, color, cobra_pendientes, orden) VALUES (5, 'fruver', 'Fruver', '#7A4BC2', 0, 5);
