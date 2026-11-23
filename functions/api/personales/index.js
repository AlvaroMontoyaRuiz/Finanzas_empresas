// Personal income and expenses of the owner (not part of any business). Administrator only.
// GET  /api/personales?desde&hasta&tipo=ingreso|gasto&q    list + totals
// POST /api/personales   { tipo, fecha, categoria, concepto, monto, medio_pago, nota }
import { route, all, json, fail, isDate, text, number } from '../../_lib/util.js';
import { insertSql } from '../../_lib/records.js';

export function parsePersonal(b) {
  if (b.tipo !== 'ingreso' && b.tipo !== 'gasto') fail('bad_tipo');
  if (!isDate(b.fecha)) fail('bad_date');
  const categoria = text(b.categoria, 40);
  if (!categoria) fail('bad_categoria');
  const concepto = text(b.concepto, 160);
  if (!concepto) fail('bad_concepto');
  const monto = Math.round(number(b.monto));
  if (!(monto > 0)) fail('bad_monto');
  return { tipo: b.tipo, fecha: b.fecha, categoria, concepto, monto, medio_pago: text(b.medio_pago, 30) || null, nota: text(b.nota, 500) || null };
}

export const onRequestGet = route(async ({ env, url }) => {
  const where = [];
  const args = [];
  const d1 = url.searchParams.get('desde');
  const d2 = url.searchParams.get('hasta');
  if (isDate(d1)) { where.push('p.fecha >= ?'); args.push(d1); }
  if (isDate(d2)) { where.push('p.fecha <= ?'); args.push(d2); }
  const t = url.searchParams.get('tipo');
  if (t === 'ingreso' || t === 'gasto') { where.push('p.tipo = ?'); args.push(t); }
  const q = (url.searchParams.get('q') || '').trim();
  if (q) { where.push('(p.concepto LIKE ? OR p.categoria LIKE ? OR p.nota LIKE ?)'); args.push(`%${q}%`, `%${q}%`, `%${q}%`); }
  const rows = await all(
    env,
    `SELECT p.* FROM personales p ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY p.fecha DESC, p.id DESC LIMIT 1000`,
    args
  );
  const ingresos = rows.filter((r) => r.tipo === 'ingreso').reduce((s, r) => s + r.monto, 0);
  const gastos = rows.filter((r) => r.tipo === 'gasto').reduce((s, r) => s + r.monto, 0);
  const porCategoria = {};
  for (const r of rows) {
    const k = r.tipo + '|' + r.categoria;
    const g = (porCategoria[k] ||= { tipo: r.tipo, nombre: r.categoria, v: 0, n: 0 });
    g.v += r.monto;
    g.n++;
  }
  return json({
    rows,
    porCategoria: Object.values(porCategoria).sort((a, b) => b.v - a.v),
    totales: { n: rows.length, ingresos, gastos, resultado: ingresos - gastos },
  });
}, { admin: true });

export const onRequestPost = route(async ({ env, user, body }) => {
  const { sql, args } = insertSql('personales', { ...parsePersonal(body), created_by: user.id });
  const r = await env.DB.prepare(sql).bind(...args).run();
  return json({ ok: true, id: r.meta.last_row_id });
}, { admin: true });
