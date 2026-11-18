// PUT    /api/usuarios/:id  { displayName?, password?, role? }   administrator
// DELETE /api/usuarios/:id                                       administrator (not yourself, not the last admin)
import { route, json, fail, text } from '../../_lib/util.js';
import { hashPassword, randomToken } from '../../_lib/auth.js';

async function load(env, id) {
  const u = await env.DB.prepare(`SELECT * FROM users WHERE id = ?`).bind(Number(id)).first();
  if (!u) fail('not_found', 404);
  return u;
}
async function admins(env) {
  return (await env.DB.prepare(`SELECT COUNT(*) AS n FROM users WHERE role = 'admin'`).first()).n;
}

export const onRequestPut = route(async ({ env, body, params, user }) => {
  const u = await load(env, params.id);
  const stmts = [];
  if (body.displayName != null) {
    stmts.push(env.DB.prepare(`UPDATE users SET display_name = ? WHERE id = ?`).bind(text(body.displayName, 60) || u.username, u.id));
  }
  if (body.role && body.role !== u.role) {
    const role = body.role === 'admin' ? 'admin' : 'usuario';
    if (u.role === 'admin' && (u.id === user.id || (await admins(env)) <= 1)) fail('last_admin');
    stmts.push(env.DB.prepare(`UPDATE users SET role = ? WHERE id = ?`).bind(role, u.id));
  }
  if (body.password) {
    if (String(body.password).length < 6) fail('password_too_short');
    const salt = randomToken(8);
    stmts.push(env.DB.prepare(`UPDATE users SET password_hash = ?, salt = ? WHERE id = ?`).bind(await hashPassword(String(body.password), salt), salt, u.id));
    if (u.id !== user.id) stmts.push(env.DB.prepare(`DELETE FROM sessions WHERE user_id = ?`).bind(u.id));
  }
  if (stmts.length) await env.DB.batch(stmts);
  return json({ ok: true });
}, { admin: true });

export const onRequestDelete = route(async ({ env, params, user }) => {
  const u = await load(env, params.id);
  if (u.id === user.id) fail('cannot_delete_self');
  if (u.role === 'admin' && (await admins(env)) <= 1) fail('last_admin');
  // Records keep their history: created_by simply stops pointing to a name.
  await env.DB.batch([
    env.DB.prepare(`DELETE FROM sessions WHERE user_id = ?`).bind(u.id),
    env.DB.prepare(`UPDATE ingresos SET created_by = NULL WHERE created_by = ?`).bind(u.id),
    env.DB.prepare(`UPDATE gastos SET created_by = NULL WHERE created_by = ?`).bind(u.id),
    env.DB.prepare(`UPDATE deletion_log SET deleted_by = NULL WHERE deleted_by = ?`).bind(u.id),
    env.DB.prepare(`DELETE FROM users WHERE id = ?`).bind(u.id),
  ]);
  return json({ ok: true });
}, { admin: true });
