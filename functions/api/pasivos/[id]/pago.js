// POST   /api/pasivos/:id/pago   { fecha, monto, nota }  register a payment (abono) to a debt
// DELETE /api/pasivos/:id/pago?pago=ID                    remove a payment registered by mistake
import { route, json, fail, first, isDate, number, text } from '../../../_lib/util.js';

export const onRequestPost = route(async ({ env, user, body, params }) => {
  const row = await first(env, `SELECT p.*, COALESCE((SELECT SUM(monto) FROM pasivo_pagos WHERE pasivo_id = p.id),0) AS abonado FROM pasivos p WHERE p.id = ?`, [Number(params.id)]);
  if (!row) fail('not_found', 404);
  if (!isDate(body.fecha)) fail('bad_date');
  const monto = Math.round(number(body.monto));
  if (!(monto > 0)) fail('bad_monto');
  if (monto > row.monto - row.abonado) fail('abono_mayor_saldo', 400, { saldo: row.monto - row.abonado });
  await env.DB.prepare(`INSERT INTO pasivo_pagos (pasivo_id, fecha, monto, nota, created_by) VALUES (?, ?, ?, ?, ?)`)
    .bind(row.id, body.fecha, monto, text(body.nota, 300) || null, user.id).run();
  return json({ ok: true });
}, { admin: true });

export const onRequestDelete = route(async ({ env, url, params }) => {
  const pago = Number(url.searchParams.get('pago'));
  const r = await env.DB.prepare(`DELETE FROM pasivo_pagos WHERE id = ? AND pasivo_id = ?`).bind(pago, Number(params.id)).run();
  if (!r.meta.changes) fail('not_found', 404);
  return json({ ok: true });
}, { admin: true });
