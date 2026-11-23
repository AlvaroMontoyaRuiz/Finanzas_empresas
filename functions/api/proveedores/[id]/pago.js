// POST   /api/proveedores/:id/pago   { fecha, monto, nota }  pay part of a supplier bill (any user)
// DELETE /api/proveedores/:id/pago?pago=ID                    remove an abono (its author or the administrator)
import { route, json, fail, first, isDate, number, text } from '../../../_lib/util.js';

export const onRequestPost = route(async ({ env, user, body, params }) => {
  const row = await first(
    env,
    `SELECT p.*, COALESCE((SELECT SUM(monto) FROM pasivo_pagos WHERE pasivo_id = p.id),0) AS abonado FROM pasivos p WHERE p.id = ? AND p.tipo = 'proveedor'`,
    [Number(params.id)]
  );
  if (!row) fail('not_found', 404);
  if (!isDate(body.fecha)) fail('bad_date');
  const monto = Math.round(number(body.monto));
  if (!(monto > 0)) fail('bad_monto');
  if (monto > row.monto - row.abonado) fail('abono_mayor_saldo', 400, { saldo: row.monto - row.abonado });
  await env.DB.prepare(`INSERT INTO pasivo_pagos (pasivo_id, fecha, monto, nota, created_by) VALUES (?, ?, ?, ?, ?)`)
    .bind(row.id, body.fecha, monto, text(body.nota, 300) || null, user.id).run();
  return json({ ok: true });
});

export const onRequestDelete = route(async ({ env, user, url, params }) => {
  const pago = await first(
    env,
    `SELECT g.* FROM pasivo_pagos g JOIN pasivos p ON p.id = g.pasivo_id WHERE g.id = ? AND g.pasivo_id = ? AND p.tipo = 'proveedor'`,
    [Number(url.searchParams.get('pago')), Number(params.id)]
  );
  if (!pago) fail('not_found', 404);
  if (user.role !== 'admin' && pago.created_by !== user.id) fail('not_your_record', 403);
  await env.DB.prepare(`DELETE FROM pasivo_pagos WHERE id = ?`).bind(pago.id).run();
  return json({ ok: true });
});
