// PUT /api/ingresos/:id   correct an income record
import { route, json, fail } from '../../_lib/util.js';
import { parseIngreso, updateSql, loadOwned, countDespostes, MAX_DESPOSTES_DIA } from '../../_lib/records.js';

export const onRequestPut = route(async ({ env, user, body, params }) => {
  const row = await loadOwned(env, 'ingresos', params.id, user);
  const v = await parseIngreso(env, body);
  if (v.medio_pago === 'desposte') {
    const ya = await countDespostes(env, v.empresa_id, v.fecha, row.id);
    if (ya + 1 > MAX_DESPOSTES_DIA) fail('max_despostes', 400, { ya });
  }
  const { sql, args } = updateSql('ingresos', v, row.id);
  await env.DB.prepare(sql).bind(...args).run();
  return json({ ok: true });
});
