// Activos entered by hand (caja y bancos, inventario, equipos, terrenos, animales…). Administrator only.
// GET  /api/activos?empresa     list + total
// POST /api/activos
import { route, all, json, fail, isDate, text, number, empresaById } from '../../_lib/util.js';
import { insertSql } from '../../_lib/records.js';

export async function parseActivo(env, b) {
  if (!isDate(b.fecha)) fail('bad_date');
  const tipo = text(b.tipo, 40);
  if (!tipo) fail('bad_tipo');
  const descripcion = text(b.descripcion, 160);
  if (!descripcion) fail('bad_descripcion');
  const valor = number(b.valor);
  if (!(valor >= 0)) fail('bad_valor');
  let empresa_id = null;
  if (b.empresa_id) {
    const e = await empresaById(env, b.empresa_id);
    if (!e) fail('bad_empresa');
    empresa_id = e.id;
  }
  return { empresa_id, fecha: b.fecha, tipo, descripcion, valor: Math.round(valor), nota: text(b.nota, 500) || null };
}

export const onRequestGet = route(async ({ env, url }) => {
  const emp = Number(url.searchParams.get('empresa')) || 0;
  const rows = await all(
    env,
    `SELECT a.*, e.nombre AS empresa, e.color AS empresa_color FROM activos a LEFT JOIN empresas e ON e.id = a.empresa_id
      ${emp ? 'WHERE a.empresa_id = ?' : ''} ORDER BY a.fecha DESC, a.id DESC LIMIT 1000`,
    emp ? [emp] : []
  );
  return json({ rows, totales: { n: rows.length, valor: rows.reduce((s, r) => s + r.valor, 0) } });
}, { admin: true });

export const onRequestPost = route(async ({ env, user, body }) => {
  const v = await parseActivo(env, body);
  const { sql, args } = insertSql('activos', { ...v, created_by: user.id });
  const r = await env.DB.prepare(sql).bind(...args).run();
  return json({ ok: true, id: r.meta.last_row_id });
}, { admin: true });
