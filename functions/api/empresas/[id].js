// PUT /api/empresas/:id  { nombre, color, cobra_pendientes, ingreso_diario }   administrator only
import { route, json, fail, text, empresaById } from '../../_lib/util.js';

export const onRequestPut = route(async ({ env, body, params }) => {
  const e = await empresaById(env, params.id);
  if (!e) fail('bad_empresa', 404);
  const nombre = text(body.nombre, 40);
  if (!nombre) fail('bad_nombre');
  const color = /^#[0-9a-fA-F]{6}$/.test(body.color || '') ? body.color : e.color;
  const dup = await env.DB.prepare(`SELECT id FROM empresas WHERE lower(nombre) = lower(?) AND id <> ?`).bind(nombre, e.id).first();
  if (dup) fail('nombre_taken');
  // Recording only the day's total (with desposte por cobrar) needs the por-cobrar option on.
  const diario = body.ingreso_diario ? 1 : 0;
  let cobra = body.cobra_pendientes || diario ? 1 : 0;
  if (!cobra) {
    // Can't switch off while sales are still waiting to be paid.
    const p = await env.DB.prepare(`SELECT COUNT(*) AS n FROM ingresos WHERE empresa_id = ? AND estado = 'pendiente'`).bind(e.id).first();
    if (p.n > 0) fail('has_pendientes', 409, { n: p.n });
  }
  await env.DB.prepare(`UPDATE empresas SET nombre = ?, color = ?, cobra_pendientes = ?, ingreso_diario = ? WHERE id = ?`).bind(nombre, color, cobra, diario, e.id).run();
  return json({ ok: true });
}, { admin: true });
