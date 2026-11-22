// GET  /api/ingresos?desde&hasta&empresa&estado&q&limit   list + totals
// POST /api/ingresos                                       create
import { route, rangeFilters, whereSql, all, first, json, fail, number, empresaById } from '../../_lib/util.js';
import { parseIngreso, insertSql } from '../../_lib/records.js';

export const onRequestGet = route(async ({ env, url }) => {
  const f = rangeFilters(url, 'i');
  const estado = url.searchParams.get('estado');
  if (estado === 'pendiente' || estado === 'pagado') { f.where.push('i.estado = ?'); f.args.push(estado); }
  // cobrados=1: sales that were "por cobrar" and are already paid (despostes cobrados)
  if (url.searchParams.get('cobrados') === '1') {
    f.where.push(`i.estado = 'pagado' AND e.cobra_pendientes = 1 AND (i.medio_pago = 'desposte' OR (i.fecha_pago IS NOT NULL AND i.fecha_pago > i.fecha))`);
  }
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
       FROM ingresos i JOIN empresas e ON e.id = i.empresa_id ${w}`,
    f.args
  );
  return json({ rows, totales: tot });
});

export const onRequestPost = route(async ({ env, user, body }) => {
  // The whole day at once: { empresa_id, fecha, montos: { efectivo, nequi, desposte }, fecha_vencimiento?, nota? }
  // One row per way of payment that has an amount, saved together or not at all.
  if (body.montos && typeof body.montos === 'object') {
    const empresa = await empresaById(env, body.empresa_id);
    if (!empresa || !empresa.ingreso_diario) fail('bad_empresa');
    const stmts = [];
    for (const medio of ['efectivo', 'nequi', 'desposte']) {
      const m = number(body.montos[medio]);
      if (!(m > 0)) continue;
      const desposte = medio === 'desposte';
      const v = await parseIngreso(env, {
        empresa_id: empresa.id,
        fecha: body.fecha,
        monto: m,
        medio_pago: medio,
        estado: desposte ? 'pendiente' : 'pagado',
        fecha_vencimiento: desposte ? body.fecha_vencimiento : '',
        nota: desposte ? body.nota : '',
      });
      const { sql, args } = insertSql('ingresos', { ...v, created_by: user.id });
      stmts.push(env.DB.prepare(sql).bind(...args));
    }
    if (!stmts.length) fail('sin_montos');
    await env.DB.batch(stmts);
    return json({ ok: true, creados: stmts.length });
  }
  const v = await parseIngreso(env, body);
  const { sql, args } = insertSql('ingresos', { ...v, created_by: user.id });
  const r = await env.DB.prepare(sql).bind(...args).run();
  return json({ ok: true, id: r.meta.last_row_id });
});
