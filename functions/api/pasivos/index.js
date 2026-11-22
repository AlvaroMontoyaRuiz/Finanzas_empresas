// Pasivos = what the owner owes to people (acreedores). Administrator only.
// GET  /api/pasivos?empresa&estado=abiertas|pagadas|todas&q   debts with what was paid so far and what is left
// POST /api/pasivos                                            register a new debt
import { route, all, json, fail, isDate, text, number, empresaById, todayCO } from '../../_lib/util.js';
import { insertSql } from '../../_lib/records.js';

export async function parsePasivo(env, b) {
  if (!isDate(b.fecha)) fail('bad_date');
  const acreedor = text(b.acreedor, 120);
  if (!acreedor) fail('bad_acreedor');
  const concepto = text(b.concepto, 160);
  if (!concepto) fail('bad_concepto');
  const monto = number(b.monto);
  if (!(monto > 0)) fail('bad_monto');
  let empresa_id = null;
  if (b.empresa_id) {
    const e = await empresaById(env, b.empresa_id);
    if (!e) fail('bad_empresa');
    empresa_id = e.id;
  }
  let fecha_vencimiento = null;
  if (b.fecha_vencimiento) {
    if (!isDate(b.fecha_vencimiento)) fail('bad_date');
    fecha_vencimiento = b.fecha_vencimiento;
  }
  return { empresa_id, fecha: b.fecha, acreedor, concepto, monto: Math.round(monto), fecha_vencimiento, nota: text(b.nota, 500) || null };
}

export const onRequestGet = route(async ({ env, url }) => {
  const where = [];
  const args = [];
  const emp = Number(url.searchParams.get('empresa')) || 0;
  if (emp) { where.push('p.empresa_id = ?'); args.push(emp); }
  const q = (url.searchParams.get('q') || '').trim();
  if (q) { where.push('(p.acreedor LIKE ? OR p.concepto LIKE ? OR p.nota LIKE ?)'); args.push(`%${q}%`, `%${q}%`, `%${q}%`); }
  const rows = await all(
    env,
    `SELECT p.*, e.nombre AS empresa, e.color AS empresa_color,
            COALESCE((SELECT SUM(g.monto) FROM pasivo_pagos g WHERE g.pasivo_id = p.id), 0) AS abonado
       FROM pasivos p LEFT JOIN empresas e ON e.id = p.empresa_id
       ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY p.fecha DESC, p.id DESC LIMIT 1000`,
    args
  );
  const pagos = rows.length
    ? await all(env, `SELECT * FROM pasivo_pagos WHERE pasivo_id IN (${rows.map(() => '?').join(',')}) ORDER BY fecha, id`, rows.map((r) => r.id))
    : [];
  const hoy = todayCO();
  let out = rows.map((r) => ({
    ...r,
    saldo: r.monto - r.abonado,
    vencida: !!r.fecha_vencimiento && r.fecha_vencimiento < hoy && r.monto - r.abonado > 0,
    pagos: pagos.filter((g) => g.pasivo_id === r.id),
  }));
  const estado = url.searchParams.get('estado');
  if (estado === 'abiertas') out = out.filter((r) => r.saldo > 0);
  if (estado === 'pagadas') out = out.filter((r) => r.saldo <= 0);
  return json({
    rows: out,
    totales: {
      n: out.length,
      monto: out.reduce((s, r) => s + r.monto, 0),
      abonado: out.reduce((s, r) => s + r.abonado, 0),
      saldo: out.reduce((s, r) => s + r.saldo, 0),
    },
  });
}, { admin: true });

export const onRequestPost = route(async ({ env, user, body }) => {
  const v = await parsePasivo(env, body);
  const { sql, args } = insertSql('pasivos', { ...v, created_by: user.id });
  const r = await env.DB.prepare(sql).bind(...args).run();
  return json({ ok: true, id: r.meta.last_row_id });
}, { admin: true });
