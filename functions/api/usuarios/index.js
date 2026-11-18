// GET  /api/usuarios   list (administrator)
// POST /api/usuarios   { username, password, displayName, role }
import { route, all, json, fail, text } from '../../_lib/util.js';
import { hashPassword, randomToken } from '../../_lib/auth.js';

export const onRequestGet = route(async ({ env }) => {
  const rows = await all(env, `SELECT id, username, role, display_name, created_at FROM users ORDER BY role, id`);
  return json({ usuarios: rows });
}, { admin: true });

export const onRequestPost = route(async ({ env, body }) => {
  const username = text(body.username, 40);
  const password = String(body.password || '');
  if (!username) fail('missing_credentials');
  if (password.length < 6) fail('password_too_short');
  const role = body.role === 'admin' ? 'admin' : 'usuario';
  const n = await env.DB.prepare(`SELECT COUNT(*) AS n FROM users`).first();
  if (n.n >= 6) fail('too_many_users');
  const dup = await env.DB.prepare(`SELECT id FROM users WHERE lower(username) = lower(?)`).bind(username).first();
  if (dup) fail('username_taken');
  const salt = randomToken(8);
  await env.DB.prepare(`INSERT INTO users (username, password_hash, salt, role, display_name) VALUES (?, ?, ?, ?, ?)`)
    .bind(username, await hashPassword(password, salt), salt, role, text(body.displayName, 60) || username).run();
  return json({ ok: true });
}, { admin: true });
