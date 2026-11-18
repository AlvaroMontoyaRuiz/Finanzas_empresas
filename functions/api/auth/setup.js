// POST /api/auth/setup
// One-time: creates the administrator + up to 3 usuarios. Refuses once any user exists.
// Body: { admin: { username, password, displayName }, usuarios: [ ... up to 3 ] }
import { hashPassword, randomToken, json } from '../../_lib/auth.js';

export const onRequestGet = async ({ env }) => {
  const r = await env.DB.prepare(`SELECT COUNT(*) AS n FROM users`).first();
  return json({ needsSetup: !r || r.n === 0 });
};

export const onRequestPost = async ({ request, env }) => {
  const existing = await env.DB.prepare(`SELECT COUNT(*) AS n FROM users`).first();
  if (existing && existing.n > 0) return json({ error: 'already_initialized' }, 409);

  const body = await request.json().catch(() => null);
  if (!body) return json({ error: 'invalid_json' }, 400);
  const { admin, usuarios = [] } = body;
  if (!admin || !admin.username || !admin.password) return json({ error: 'admin_required' }, 400);
  if (usuarios.length > 3) return json({ error: 'too_many_users' }, 400);

  const list = [{ ...admin, role: 'admin' }, ...usuarios.map((u) => ({ ...u, role: 'usuario' }))];
  const names = new Set();
  for (const u of list) {
    if (!u.username || !u.password) return json({ error: 'missing_credentials' }, 400);
    if (String(u.password).length < 6) return json({ error: 'password_too_short' }, 400);
    const k = String(u.username).trim().toLowerCase();
    if (names.has(k)) return json({ error: 'username_taken' }, 400);
    names.add(k);
  }

  const stmts = [];
  for (const u of list) {
    const salt = randomToken(8);
    const hash = await hashPassword(u.password, salt);
    stmts.push(
      env.DB.prepare(`INSERT INTO users (username, password_hash, salt, role, display_name) VALUES (?, ?, ?, ?, ?)`)
        .bind(String(u.username).trim(), hash, salt, u.role, (u.displayName || u.username).trim())
    );
  }
  await env.DB.batch(stmts);
  return json({ ok: true, created: list.length });
};
