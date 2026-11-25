// GET  /api/ingresos?desde&hasta&empresa&estado&q&limit   list + totals
// POST /api/ingresos                                       create
import { route, rangeFilters, whereSql, all, first, json, fail, number, empresaById } from '../../_lib/util.js';
import { parseIngreso, insertSql, countDespostes, MAX_DESPOSTES_DIA } from '../../_lib/records.js';

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
            COALESCE(SUM(CASE WHEN i.estado='pendiente' THEN i.total - i.abono_efectivo END),0) AS pendiente
       FROM ingresos i JOIN empresas e ON e.id = i.empresa_id ${w}`,
    f.args
  );
  return json({ rows, totales: tot });
});

export const onRequestPost = route(async ({ env, user, body }) => {
  // The whole day at once (Carnicería):
  // { empresa_id, fecha, montos: { efectivo, nequi }, despostes: [{ valor, efectivo, fecha_vencimiento, nota }, ...] }
  // Efectivo and Nequi make one row each. Every desposte makes its own row (at most 5 per day): its value, the part
  // paid in cash on the spot, and the rest stays por cobrar. All saved together or not at all.
  // Only companies that record the day's total (Carnicería) use this path; any other company always gets the
  // full form, even if day fields come along by mistake.
  const empDia = (body.montos && typeof body.montos === 'object') || Array.isArray(body.despostes) ? await empresaById(env, body.empresa_id) : null;
  if (empDia && empDia.ingreso_diario) {
    const montos = body.montos && typeof body.montos === 'object' ? body.montos : {};
    const empresa = empDia;
    const stmts = [];
    const add = async (extra) => {
      const v = await parseIngreso(env, { empresa_id: empresa.id, fecha: body.fecha, ...extra });
      const { sql, args } = insertSql('ingresos', { ...v, created_by: user.id });
      stmts.push(env.DB.prepare(sql).bind(...args));
    };
    for (const medio of ['efectivo', 'nequi']) {
      const m = number(montos[medio]);
      if (m > 0) await add({ monto: m, medio_pago: medio, estado: 'pagado' });
    }
    let desp = Array.isArray(body.despostes) ? body.despostes : [];
    if (!desp.length && number(montos.desposte) > 0) desp = [{ valor: montos.desposte }]; // older form
    desp = desp.filter((d) => d && (number(d.valor) > 0 || number(d.efectivo) > 0));
    if (desp.length && !empresa.cobra_pendientes) fail('sin_despostes');
    if (desp.length > MAX_DESPOSTES_DIA) fail('max_despostes', 400, { ya: 0 });
    if (desp.length) {
      const ya = await countDespostes(env, empresa.id, body.fecha);
      if (ya + desp.length > MAX_DESPOSTES_DIA) fail('max_despostes', 400, { ya });
    }
    for (const d of desp) {
      await add({
        monto: d.valor,
        medio_pago: 'desposte',
        abono_efectivo: d.efectivo,
        estado: 'pendiente',
        fecha_vencimiento: d.fecha_vencimiento,
        nota: d.nota,
      });
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
