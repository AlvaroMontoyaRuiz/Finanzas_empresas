// PUT /api/ingresos/:id   correct an income record
import { route, json } from '../../_lib/util.js';
import { parseIngreso, updateSql, loadOwned } from '../../_lib/records.js';

export const onRequestPut = route(async ({ env, user, body, params }) => {
  const row = await loadOwned(env, 'ingresos', params.id, user);
  const v = await parseIngreso(env, body);
  const { sql, args } = updateSql('ingresos', v, row.id);
  await env.DB.prepare(sql).bind(...args).run();
  return json({ ok: true });
});
