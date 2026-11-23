// Por pagar: supplier bills (facturas de proveedores) that are paid little by little with abonos.
// Stored in `pasivos` with tipo = 'proveedor', so they also count as Pasivo in the Balance.
// Every user can see them and register bills and abonos; editing/deleting a bill: its author or the administrator.
// GET  /api/proveedores?empresa&estado=abiertas|pagadas|todas&q
// POST /api/proveedores   { empresa_id, fecha, proveedor, factura, concepto, monto, fecha_vencimiento, nota, abono_inicial }
import { route, all, json, fail, isDate, text, number, empresaById, todayCO } from '../../_lib/util.js';
import { insertSql } from '../../_lib/records.js';

export async function parseFactura(env, b) {
  if (!isDate(b.fecha)) fail('bad_date');
  const e = await empresaById(env, b.empresa_id);
  if (!e) fail('bad_empresa');
  const acreedor = text(b.proveedor, 120);
  if (!acreedor) fail('bad_proveedor');
  const monto = Math.round(number(b.monto));
  if (!(monto > 0)) fail('bad_monto');
  let fecha_vencimiento = null;
  if (b.fecha_vencimiento) {
    if (!isDate(b.fecha_vencimiento)) fail('bad_date');
    fecha_vencimiento = b.fecha_vencimiento;
  }
  const factura = text(b.factura, 60) || null;
  return {
    tipo: 'proveedor',
    empresa_id: e.id,
    fecha: b.fecha,
    acreedor,
    factura,
    concepto: text(b.concepto, 160) || (factura ? `Factura ${factura}` : 'Factura'),
    monto,
    fecha_vencimiento,
    nota: text(b.nota, 500) || null,
  };
}

export const onRequestGet = route(async ({ env, url }) => {
  const where = ["p.tipo = 'proveedor'"];
  const args = [];
  const emp = Number(url.searchParams.get('empresa')) || 0;
  if (emp) { where.push('p.empresa_id = ?'); args.push(emp); }
  const q = (url.searchParams.get('q') || '').trim();
  if (q) { where.push('(p.acreedor LIKE ? OR p.factura LIKE ? OR p.concepto LIKE ?)'); args.push(`%${q}%`, `%${q}%`, `%${q}%`); }
  const rows = await all(
    env,
    `SELECT p.*, e.nombre AS empresa, e.color AS empresa_color, u.display_name AS creado_por,
            COALESCE((SELECT SUM(g.monto) FROM pasivo_pagos g WHERE g.pasivo_id = p.id), 0) AS abonado
       FROM pasivos p LEFT JOIN empresas e ON e.id = p.empresa_id LEFT JOIN users u ON u.id = p.created_by
      WHERE ${where.join(' AND ')} ORDER BY p.fecha DESC, p.id DESC LIMIT 1000`,
    args
  );
  const pagos = rows.length
    ? await all(env, `SELECT * FROM pasivo_pagos WHERE pasivo_id IN (${rows.map(() => '?').join(',')}) ORDER BY fecha, id`, rows.map((r) => r.id))
    : [];
  const hoy = todayCO();
  let out = rows.map((r) => ({
    ...r,
    proveedor: r.acreedor,
    saldo: r.monto - r.abonado,
    vencida: !!r.fecha_vencimiento && r.fecha_vencimiento < hoy && r.monto - r.abonado > 0,
    pagos: pagos.filter((g) => g.pasivo_id === r.id),
  }));
  const estado = url.searchParams.get('estado') || 'abiertas';
  if (estado === 'abiertas') out = out.filter((r) => r.saldo > 0);
  if (estado === 'pagadas') out = out.filter((r) => r.saldo <= 0);
  // what is still owed, per supplier
  const porProveedor = {};
  for (const r of out) {
    if (r.saldo <= 0) continue;
    const k = r.acreedor.trim().toLowerCase();
    const g = (porProveedor[k] ||= { nombre: r.acreedor.trim(), saldo: 0, n: 0 });
    g.saldo += r.saldo;
    g.n++;
  }
  return json({
    rows: out,
    porProveedor: Object.values(porProveedor).sort((a, b) => b.saldo - a.saldo),
    totales: {
      n: out.length,
      monto: out.reduce((s, r) => s + r.monto, 0),
      abonado: out.reduce((s, r) => s + r.abonado, 0),
      saldo: out.reduce((s, r) => s + r.saldo, 0),
      vencidas: out.filter((r) => r.vencida).length,
    },
  });
});

export const onRequestPost = route(async ({ env, user, body }) => {
  const v = await parseFactura(env, body);
  const inicial = body.abono_inicial === '' || body.abono_inicial == null ? 0 : Math.round(number(body.abono_inicial));
  if (!(inicial >= 0)) fail('bad_abono');
  if (inicial > v.monto) fail('abono_mayor_saldo', 400, { saldo: v.monto });
  const { sql, args } = insertSql('pasivos', { ...v, created_by: user.id });
  const r = await env.DB.prepare(sql).bind(...args).run();
  const id = r.meta.last_row_id;
  if (inicial > 0) {
    await env.DB.prepare(`INSERT INTO pasivo_pagos (pasivo_id, fecha, monto, nota, created_by) VALUES (?, ?, ?, ?, ?)`)
      .bind(id, v.fecha, inicial, 'Abono inicial', user.id).run();
  }
  return json({ ok: true, id });
});
