// GET /api/balance?desde&hasta&empresa   the balance in one request (administrator)
//   Activo     = por cobrar (what customers still owe: despostes and pending sales) + activos entered by hand
//   Pasivo     = what is still owed on the debts registered (money borrowed / owed to people)
//   Patrimonio = Activo − Pasivo
//   Ingresos / Egresos = income and expenses of the chosen period
//   Deuda      = what they owe me (por cobrar) vs. what I owe (pasivo)
import { route, all, first, json, isDate, todayCO } from '../_lib/util.js';

export const onRequestGet = route(async ({ env, url }) => {
  const hoy = todayCO();
  let desde = url.searchParams.get('desde');
  let hasta = url.searchParams.get('hasta');
  if (!isDate(desde)) desde = hoy.slice(0, 4) + '-01-01';
  if (!isDate(hasta)) hasta = hoy;
  if (hasta < desde) [desde, hasta] = [hasta, desde];
  const emp = Number(url.searchParams.get('empresa')) || 0;
  const ew = emp ? ' AND empresa_id = ?' : '';
  const ea = emp ? [emp] : [];

  const [porCobrar, activos, porTipo, pasivos, ingresos, gastos] = await Promise.all([
    first(env, `SELECT COUNT(*) AS n, COALESCE(SUM(total - abono_efectivo),0) AS saldo FROM ingresos WHERE estado = 'pendiente'${ew}`, ea),
    first(env, `SELECT COUNT(*) AS n, COALESCE(SUM(valor),0) AS valor FROM activos WHERE 1 = 1${ew}`, ea),
    all(env, `SELECT tipo AS nombre, SUM(valor) AS v, COUNT(*) AS n FROM activos WHERE 1 = 1${ew} GROUP BY tipo ORDER BY v DESC`, ea),
    all(env, `SELECT p.id, p.tipo, p.acreedor, p.monto, p.fecha_vencimiento,
                     p.monto - COALESCE((SELECT SUM(g.monto) FROM pasivo_pagos g WHERE g.pasivo_id = p.id), 0) AS saldo
                FROM pasivos p WHERE 1 = 1${emp ? ' AND p.empresa_id = ?' : ''}`, ea),
    first(env, `SELECT COALESCE(SUM(total),0) AS total, COUNT(*) AS n FROM ingresos WHERE fecha >= ? AND fecha <= ?${ew}`, [desde, hasta, ...ea]),
    first(env, `SELECT COALESCE(SUM(total),0) AS total, COALESCE(SUM(iva),0) AS iva, COUNT(*) AS n FROM gastos WHERE fecha >= ? AND fecha <= ?${ew}`, [desde, hasta, ...ea]),
  ]);

  const abiertas = pasivos.filter((p) => p.saldo > 0);
  const porAcreedor = {};
  for (const p of abiertas) {
    const k = p.acreedor.trim().toLowerCase();
    const g = (porAcreedor[k] ||= { nombre: p.acreedor.trim(), v: 0, n: 0 });
    g.v += p.saldo;
    g.n++;
  }
  const pasivoTotal = abiertas.reduce((s, p) => s + p.saldo, 0);
  const activoTotal = porCobrar.saldo + activos.valor;

  return json({
    desde,
    hasta,
    hoy,
    activo: { total: activoTotal, porCobrar: porCobrar.saldo, porCobrarN: porCobrar.n, registrados: activos.valor, registradosN: activos.n, porTipo },
    pasivo: {
      total: pasivoTotal,
      n: abiertas.length,
      vencidas: abiertas.filter((p) => p.fecha_vencimiento && p.fecha_vencimiento < hoy).length,
      deudas: abiertas.filter((p) => p.tipo !== 'proveedor').reduce((s, p) => s + p.saldo, 0),
      proveedores: abiertas.filter((p) => p.tipo === 'proveedor').reduce((s, p) => s + p.saldo, 0),
      porAcreedor: Object.values(porAcreedor).sort((a, b) => b.v - a.v),
    },
    patrimonio: activoTotal - pasivoTotal,
    periodo: { ingresos: ingresos.total, egresos: gastos.total, resultado: ingresos.total - gastos.total, nIngresos: ingresos.n, nEgresos: gastos.n },
    deuda: { meDeben: porCobrar.saldo, debo: pasivoTotal, neta: porCobrar.saldo - pasivoTotal },
  });
}, { admin: true });
