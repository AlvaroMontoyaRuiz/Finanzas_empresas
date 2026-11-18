// DELETE /api/record/:table/:id   { reason? }
// Copies the row into deletion_log, then removes it. Users delete their own rows; the admin anyone's.
import { route, json, fail } from '../../../_lib/util.js';
import { loadOwned } from '../../../_lib/records.js';

const ALLOWED = new Set(['ingresos', 'gastos']);

export const onRequestDelete = route(async ({ env, user, body, params }) => {
  if (!ALLOWED.has(params.table)) fail('bad_table');
  const row = await loadOwned(env, params.table, params.id, user);
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO deletion_log (table_name, record_id, payload_json, deleted_by, reason) VALUES (?, ?, ?, ?, ?)`)
      .bind(params.table, row.id, JSON.stringify(row), user.id, (body.reason || '').toString().slice(0, 300) || null),
    env.DB.prepare(`DELETE FROM ${params.table} WHERE id = ?`).bind(row.id),
  ]);
  return json({ ok: true });
});
