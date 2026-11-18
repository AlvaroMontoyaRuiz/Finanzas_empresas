// GET  /api/gastos?desde&hasta&empresa&categoria&iva&q&limit   list + totals
// POST /api/gastos                                             create
import { route, rangeFilters, whereSql, all, first, json } from '../../_lib/util.js';
import { parseGasto, insertSql } from '../../_lib/records.js';

export const onRequestGet = route(async ({ env, url }) => {
  const f = rangeFilters(url, 'g');
  const cat = (url.searchParams.get('categoria') || '').trim();
  if (cat) { f.where.push('g.categoria = ?'); f.args.push(cat); }
  const iva = url.searchParams.get('iva');
  if (iva === 'con') f.where.push('g.iva > 0');
  if (iva === 'sin') f.where.push('g.iva = 0');
  const q = (url.searchParams.get('q') || '').trim();
  if (q) {
    f.where.push('(g.proveedor LIKE ? OR g.concepto LIKE ? OR g.factura LIKE ? OR g.nit LIKE ? OR g.nota LIKE ?)');
    f.args.push(...Array(5).fill(`%${q}%`));
  }
  const limit = Math.min(Number(url.searchParams.get('limit')) || 1000, 5000);
  const w = whereSql(f.where);
  const rows = await all(
    env,
    `SELECT g.*, e.nombre AS empresa, e.color AS empresa_color, u.display_name AS creado_por
       FROM gastos g JOIN empresas e ON e.id = g.empresa_id LEFT JOIN users u ON u.id = g.created_by
       ${w} ORDER BY g.fecha DESC, g.id DESC LIMIT ${limit}`,
    f.args
  );
  const tot = await first(
    env,
    `SELECT COUNT(*) AS n, COALESCE(SUM(g.base),0) AS base, COALESCE(SUM(g.iva),0) AS iva, COALESCE(SUM(g.total),0) AS total
       FROM gastos g ${w}`,
    f.args
  );
  return json({ rows, totales: tot });
});

export const onRequestPost = route(async ({ env, user, body }) => {
  const v = await parseGasto(env, body);
  const { sql, args } = insertSql('gastos', { ...v, created_by: user.id });
  const r = await env.DB.prepare(sql).bind(...args).run();
  return json({ ok: true, id: r.meta.last_row_id });
});
