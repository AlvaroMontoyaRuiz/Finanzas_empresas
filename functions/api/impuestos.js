// GET /api/impuestos?anio=2026&empresa=   IVA and totals for the tax return (administrator)
// - bimestres: IVA in Colombia is declared every two months (or every four for small taxpayers)
// - per IVA rate (0 %, 5 %, 19 %)
// - per proveedor (NIT, base, IVA, total) — handy for información exógena / certificates
import { route, all, json, todayCO } from '../_lib/util.js';

export const onRequestGet = route(async ({ env, url }) => {
  const anio = /^\d{4}$/.test(url.searchParams.get('anio') || '') ? url.searchParams.get('anio') : todayCO().slice(0, 4);
  const emp = Number(url.searchParams.get('empresa')) || 0;
  const W = `fecha >= ? AND fecha <= ?${emp ? ' AND empresa_id = ?' : ''}`;
  const A = [`${anio}-01-01`, `${anio}-12-31`, ...(emp ? [emp] : [])];
  const bim = `((CAST(substr(fecha,6,2) AS INTEGER) + 1) / 2)`;

  const [gBim, iBim, porTarifa, porEmpresa, proveedores, sinFactura, anios] = await Promise.all([
    all(env, `SELECT ${bim} AS b, SUM(base) AS base, SUM(iva) AS iva, SUM(total) AS total, COUNT(*) AS n,
                     SUM(CASE WHEN iva > 0 THEN base ELSE 0 END) AS base_gravada,
                     SUM(CASE WHEN iva = 0 THEN total ELSE 0 END) AS sin_iva
                FROM gastos WHERE ${W} GROUP BY b`, A),
    all(env, `SELECT ${bim} AS b, SUM(total) AS total, COUNT(*) AS n FROM ingresos WHERE ${W} GROUP BY b`, A),
    all(env, `SELECT iva_tarifa AS tarifa, SUM(base) AS base, SUM(iva) AS iva, SUM(total) AS total, COUNT(*) AS n
                FROM gastos WHERE ${W} GROUP BY iva_tarifa ORDER BY iva_tarifa`, A),
    all(env, `SELECT e.id, e.nombre, e.color,
                     COALESCE((SELECT SUM(total) FROM ingresos i WHERE i.empresa_id = e.id AND i.fecha BETWEEN ? AND ?),0) AS ingresos,
                     COALESCE((SELECT SUM(base) FROM gastos g WHERE g.empresa_id = e.id AND g.fecha BETWEEN ? AND ?),0) AS base,
                     COALESCE((SELECT SUM(iva) FROM gastos g WHERE g.empresa_id = e.id AND g.fecha BETWEEN ? AND ?),0) AS iva,
                     COALESCE((SELECT SUM(total) FROM gastos g WHERE g.empresa_id = e.id AND g.fecha BETWEEN ? AND ?),0) AS total
                FROM empresas e ${emp ? 'WHERE e.id = ?' : ''} ORDER BY e.orden, e.id`,
      [...Array(4).fill([A[0], A[1]]).flat(), ...(emp ? [emp] : [])]),
    all(env, `SELECT proveedor, MAX(nit) AS nit, COUNT(*) AS n, SUM(base) AS base, SUM(iva) AS iva, SUM(total) AS total
                FROM gastos WHERE ${W} GROUP BY proveedor ORDER BY total DESC`, A),
    all(env, `SELECT COUNT(*) AS n, COALESCE(SUM(total),0) AS total FROM gastos WHERE ${W} AND (factura IS NULL OR factura = '')`, A),
    all(env, `SELECT DISTINCT substr(fecha,1,4) AS a FROM (SELECT fecha FROM gastos UNION SELECT fecha FROM ingresos) ORDER BY a DESC`),
  ]);

  const gb = Object.fromEntries(gBim.map((r) => [r.b, r]));
  const ib = Object.fromEntries(iBim.map((r) => [r.b, r]));
  const NOMBRES = ['Ene – Feb', 'Mar – Abr', 'May – Jun', 'Jul – Ago', 'Sep – Oct', 'Nov – Dic'];
  const bimestres = NOMBRES.map((nombre, i) => {
    const g = gb[i + 1] || {};
    return {
      bimestre: i + 1,
      nombre,
      ingresos: ib[i + 1]?.total || 0,
      base: g.base || 0,
      base_gravada: g.base_gravada || 0,
      sin_iva: g.sin_iva || 0,
      iva: g.iva || 0,
      total: g.total || 0,
      n: g.n || 0,
    };
  });

  const years = new Set(anios.map((r) => r.a));
  years.add(todayCO().slice(0, 4));

  return json({
    anio,
    anios: [...years].sort().reverse(),
    bimestres,
    porTarifa,
    porEmpresa,
    proveedores,
    sinFactura: sinFactura[0],
  });
}, { admin: true });
