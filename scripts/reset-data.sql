-- Start from zero: deletes ALL records and users (the 4 empresas stay).
-- Afterwards open /setup to create the users again.
DELETE FROM sessions;
DELETE FROM ingresos;
DELETE FROM gastos;
DELETE FROM deletion_log;
DELETE FROM users;
DELETE FROM sqlite_sequence WHERE name IN ('ingresos','gastos','deletion_log','users');
