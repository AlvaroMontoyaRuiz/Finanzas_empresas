// PUT /api/proveedores/:id   correct a supplier bill (its author or the administrator).
import { route, json, fail, first } from '../../_lib/util.js';
import { updateSql, loadOwned } from '../../_lib/records.js';
import { parseFactura } from './index.js';

export const onRequestPut = route(async ({ env, user, body, params }) => {
  const row = await loadOwned(env, 'pasivos', params.id, user);
  if (row.tipo !== 'proveedor') fail('not_found', 404);
  const v = await parseFactura(env, body);
  const ab = await first(env, `SELECT COALESCE(SUM(monto),0) AS s FROM pasivo_pagos WHERE pasivo_id = ?`, [row.id]);
  if (v.monto < ab.s) fail('monto_menor_abonos', 400, { abonado: ab.s });
  const { sql, args } = updateSql('pasivos', v, row.id);
  await env.DB.prepare(sql).bind(...args).run();
  return json({ ok: true });
});
