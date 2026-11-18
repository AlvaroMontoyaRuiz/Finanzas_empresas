// PUT /api/gastos/:id   correct an expense record
import { route, json } from '../../_lib/util.js';
import { parseGasto, updateSql, loadOwned } from '../../_lib/records.js';

export const onRequestPut = route(async ({ env, user, body, params }) => {
  const row = await loadOwned(env, 'gastos', params.id, user);
  const v = await parseGasto(env, body);
  const { sql, args } = updateSql('gastos', v, row.id);
  await env.DB.prepare(sql).bind(...args).run();
  return json({ ok: true });
});
