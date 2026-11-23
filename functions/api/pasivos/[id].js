// PUT /api/pasivos/:id   correct a debt (administrator). The amount can't go below what was already paid.
import { route, json, fail, first } from '../../_lib/util.js';
import { updateSql } from '../../_lib/records.js';
import { parsePasivo } from './index.js';

export const onRequestPut = route(async ({ env, body, params }) => {
  const row = await first(env, `SELECT * FROM pasivos WHERE id = ? AND tipo = 'deuda'`, [Number(params.id)]);
  if (!row) fail('not_found', 404);
  const v = await parsePasivo(env, body);
  const ab = await first(env, `SELECT COALESCE(SUM(monto),0) AS s FROM pasivo_pagos WHERE pasivo_id = ?`, [row.id]);
  if (v.monto < ab.s) fail('monto_menor_abonos', 400, { abonado: ab.s });
  const { sql, args } = updateSql('pasivos', v, row.id);
  await env.DB.prepare(sql).bind(...args).run();
  return json({ ok: true });
}, { admin: true });
