-- "Personal" is now a company (the owner's own money), entered with the normal Ingresos / Gastos screens.
-- The app does this by itself on the first request (schema.js); reference only.
INSERT OR IGNORE INTO empresas (id, slug, nombre, color, cobra_pendientes, orden) VALUES (6, 'personal', 'Personal', '#5C6B73', 0, 6);
