// GET /api/dashboard?desde&hasta&empresa   everything the Panel shows, in one request (administrator)
import { route, all, first, json, isDate, todayCO } from '../_lib/util.js';

function shiftDays(s, n) {
  const d = new Date(s + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
const daysBetween = (a, b) => Math.round((new Date(b + 'T00:00:00Z') - new Date(a + 'T00:00:00Z')) / 86400000);

function monthsBetween(desde, hasta) {
  const out = [];
  let y = Number(desde.slice(0, 4));
  let m = Number(desde.slice(5, 7));
  const end = hasta.slice(0, 7);
  for (let i = 0; i < 120; i++) {
    const k = `${y}-${String(m).padStart(2, '0')}`;
    out.push(k);
    if (k >= end) break;
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return out;
}

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
  const R = `fecha >= ? AND fecha <= ?${ew}`;
  const ra = [desde, hasta, ...ea];

  // Same-length period right before, for the "vs. periodo anterior" arrows.
  const len = daysBetween(desde, hasta);
  const pHasta = shiftDays(desde, -1);
  const pDesde = shiftDays(pHasta, -len);
  const pa = [pDesde, pHasta, ...ea];

  const totals = (args) =>
    Promise.all([
      first(env, `SELECT COUNT(*) AS n, COALESCE(SUM(total),0) AS total,
                         COALESCE(SUM(CASE WHEN estado='pagado' THEN total END),0) AS cobrado,
                         COALESCE(SUM(CASE WHEN estado='pendiente' THEN total END),0) AS pendiente
                    FROM ingresos WHERE ${R}`, args),
      first(env, `SELECT COUNT(*) AS n, COALESCE(SUM(base),0) AS base, COALESCE(SUM(iva),0) AS iva, COALESCE(SUM(total),0) AS total
                    FROM gastos WHERE ${R}`, args),
    ]);

  const [
    [ing, gas],
    [pIng, pGas],
    ingMes,
    gasMes,
    ingEmp,
    gasEmp,
    categorias,
    clientes,
    conceptos,
    proveedores,
    cartera,
    carteraLista,
  ] = await Promise.all([
    totals(ra),
    totals(pa),
    all(env, `SELECT substr(fecha,1,7) AS mes, SUM(total) AS v FROM ingresos WHERE ${R} GROUP BY mes`, ra),
    all(env, `SELECT substr(fecha,1,7) AS mes, SUM(total) AS v, SUM(iva) AS iva FROM gastos WHERE ${R} GROUP BY mes`, ra),
    all(env, `SELECT empresa_id, SUM(total) AS v, COUNT(*) AS n FROM ingresos WHERE fecha >= ? AND fecha <= ? GROUP BY empresa_id`, [desde, hasta]),
    all(env, `SELECT empresa_id, SUM(total) AS v, SUM(iva) AS iva, COUNT(*) AS n FROM gastos WHERE fecha >= ? AND fecha <= ? GROUP BY empresa_id`, [desde, hasta]),
    all(env, `SELECT categoria AS nombre, SUM(total) AS v, COUNT(*) AS n FROM gastos WHERE ${R} GROUP BY categoria ORDER BY v DESC`, ra),
    all(env, `SELECT cliente AS nombre, SUM(total) AS v, COUNT(*) AS n FROM ingresos WHERE ${R} AND cliente <> '' GROUP BY cliente ORDER BY v DESC LIMIT 8`, ra),
    all(env, `SELECT concepto AS nombre, SUM(total) AS v, SUM(cantidad) AS cantidad, MAX(unidad) AS unidad, COUNT(*) AS n
                FROM ingresos WHERE ${R} GROUP BY concepto ORDER BY v DESC LIMIT 8`, ra),
    all(env, `SELECT proveedor AS nombre, SUM(total) AS v, COUNT(*) AS n FROM gastos WHERE ${R} GROUP BY proveedor ORDER BY v DESC LIMIT 8`, ra),
    // Cartera = everything still pending today, whatever its date.
    all(env, `SELECT julianday(?) - julianday(fecha) AS dias, total FROM ingresos WHERE estado='pendiente'${ew}`, [hoy, ...ea]),
    all(env, `SELECT i.id, i.fecha, i.cliente, i.concepto, i.nota, i.total, i.fecha_vencimiento, e.nombre AS empresa
                FROM ingresos i JOIN empresas e ON e.id = i.empresa_id
               WHERE i.estado='pendiente'${emp ? ' AND i.empresa_id = ?' : ''} ORDER BY i.fecha ASC LIMIT 8`, ea),
  ]);

  const im = Object.fromEntries(ingMes.map((r) => [r.mes, r.v]));
  const gm = Object.fromEntries(gasMes.map((r) => [r.mes, r]));
  const porMes = monthsBetween(desde, hasta).map((mes) => {
    const i = im[mes] || 0;
    const g = gm[mes]?.v || 0;
    return { mes, ingresos: i, gastos: g, utilidad: i - g, iva: gm[mes]?.iva || 0 };
  });

  const empresas = await all(env, `SELECT id, nombre, color, cobra_pendientes FROM empresas ORDER BY orden, id`);
  const ie = Object.fromEntries(ingEmp.map((r) => [r.empresa_id, r]));
  const ge = Object.fromEntries(gasEmp.map((r) => [r.empresa_id, r]));
  const porEmpresa = empresas.map((e) => ({
    id: e.id,
    nombre: e.nombre,
    color: e.color,
    ingresos: ie[e.id]?.v || 0,
    gastos: ge[e.id]?.v || 0,
    iva: ge[e.id]?.iva || 0,
    utilidad: (ie[e.id]?.v || 0) - (ge[e.id]?.v || 0),
    nIngresos: ie[e.id]?.n || 0,
    nGastos: ge[e.id]?.n || 0,
  }));

  const buckets = [
    { label: '0–30 días', min: 0, max: 30 },
    { label: '31–60 días', min: 31, max: 60 },
    { label: '61–90 días', min: 61, max: 90 },
    { label: 'Más de 90 días', min: 91, max: Infinity },
  ].map((b) => {
    const rows = cartera.filter((r) => Math.floor(r.dias) >= b.min && Math.floor(r.dias) <= b.max);
    return { label: b.label, n: rows.length, total: rows.reduce((s, r) => s + r.total, 0) };
  });

  return json({
    desde,
    hasta,
    hoy,
    anterior: { desde: pDesde, hasta: pHasta, ingresos: pIng.total, gastos: pGas.total, utilidad: pIng.total - pGas.total },
    ingresos: ing,
    gastos: gas,
    utilidad: ing.total - gas.total,
    porMes,
    porEmpresa,
    categorias,
    clientes,
    conceptos,
    proveedores,
    cartera: {
      n: cartera.length,
      total: cartera.reduce((s, r) => s + r.total, 0),
      buckets,
      lista: carteraLista,
    },
  });
}, { admin: true });
