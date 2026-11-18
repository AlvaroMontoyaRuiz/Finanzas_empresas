// GET  /api/ingresos?desde&hasta&empresa&estado&q&limit   list + totals
// POST /api/ingresos                                       create
import { route, rangeFilters, whereSql, all, first, json } from '../../_lib/util.js';
import { parseIngreso, insertSql } from '../../_lib/records.js';

export const onRequestGet = route(async ({ env, url }) => {
  const f = rangeFilters(url, 'i');
  const estado = url.searchParams.get('estado');
  if (estado === 'pendiente' || estado === 'pagado') { f.where.push('i.estado = ?'); f.args.push(estado); }
  const q = (url.searchParams.get('q') || '').trim();
  if (q) {
    f.where.push('(i.cliente LIKE ? OR i.concepto LIKE ? OR i.nota LIKE ?)');
    f.args.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }
  const limit = Math.min(Number(url.searchParams.get('limit')) || 1000, 5000);
  const w = whereSql(f.where);
  const rows = await all(
    env,
    `SELECT i.*, e.nombre AS empresa, e.color AS empresa_color, u.display_name AS creado_por
       FROM ingresos i JOIN empresas e ON e.id = i.empresa_id LEFT JOIN users u ON u.id = i.created_by
       ${w} ORDER BY i.fecha DESC, i.id DESC LIMIT ${limit}`,
    f.args
  );
  const tot = await first(
    env,
    `SELECT COUNT(*) AS n, COALESCE(SUM(i.total),0) AS total,
            COALESCE(SUM(CASE WHEN i.estado='pendiente' THEN i.total END),0) AS pendiente
       FROM ingresos i ${w}`,
    f.args
  );
  return json({ rows, totales: tot });
});

export const onRequestPost = route(async ({ env, user, body }) => {
  const v = await parseIngreso(env, body);
  const { sql, args } = insertSql('ingresos', { ...v, created_by: user.id });
  const r = await env.DB.prepare(sql).bind(...args).run();
  return json({ ok: true, id: r.meta.last_row_id });
});
