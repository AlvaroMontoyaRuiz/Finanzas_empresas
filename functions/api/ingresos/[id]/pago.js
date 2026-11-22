// POST /api/ingresos/:id/pago  { pagado: true|false, fecha_pago?, medio_pago? }
// Marks a "pendiente por cobrar" sale as paid (or back to pending). Anyone logged in can do it.
import { route, json, fail, isDate, todayCO } from '../../../_lib/util.js';
import { MEDIOS_PAGO } from '../../../_lib/records.js';

export const onRequestPost = route(async ({ env, body, params }) => {
  const id = Number(params.id);
  const row = await env.DB.prepare(`SELECT i.*, e.cobra_pendientes FROM ingresos i JOIN empresas e ON e.id = i.empresa_id WHERE i.id = ?`).bind(id).first();
  if (!row) fail('not_found', 404);
  if (body.pagado) {
    const fecha = body.fecha_pago || todayCO();
    if (!isDate(fecha)) fail('bad_date');
    if (fecha < row.fecha) fail('pago_before_sale');
    // A desposte keeps its payment method; for anything else the person can say how it was paid.
    const medio = row.medio_pago !== 'desposte' && MEDIOS_PAGO.includes(body.medio_pago) ? body.medio_pago : row.medio_pago;
    await env.DB.prepare(`UPDATE ingresos SET estado='pagado', fecha_pago=?, medio_pago=?, updated_at=datetime('now') WHERE id=?`).bind(fecha, medio, id).run();
  } else {
    if (!row.cobra_pendientes) fail('no_pendientes');
    if (row.total - row.abono_efectivo <= 0) fail('sin_saldo'); // a desposte paid fully in cash has nothing to collect
    await env.DB.prepare(`UPDATE ingresos SET estado='pendiente', fecha_pago=NULL, updated_at=datetime('now') WHERE id=?`).bind(id).run();
  }
  return json({ ok: true });
});
