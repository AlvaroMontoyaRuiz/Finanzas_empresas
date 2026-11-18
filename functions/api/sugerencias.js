// GET /api/sugerencias?empresa=   previous values for the autocomplete lists of the forms
import { route, all, json } from '../_lib/util.js';

export const onRequestGet = route(async ({ env, url }) => {
  const emp = Number(url.searchParams.get('empresa')) || 0;
  const w = emp ? 'WHERE empresa_id = ?' : '';
  const a = emp ? [emp] : [];
  const pick = (sql) => all(env, sql, a).then((r) => r.map((x) => x.v));
  const [clientes, conceptosIng, proveedores, categorias, conceptosGas, unidades] = await Promise.all([
    pick(`SELECT cliente AS v FROM ingresos ${w} GROUP BY cliente ORDER BY MAX(fecha) DESC LIMIT 200`),
    pick(`SELECT concepto AS v FROM ingresos ${w} GROUP BY concepto ORDER BY COUNT(*) DESC LIMIT 100`),
    all(env, `SELECT proveedor AS v, MAX(nit) AS nit FROM gastos ${w} GROUP BY proveedor ORDER BY MAX(fecha) DESC LIMIT 200`, a),
    pick(`SELECT categoria AS v FROM gastos ${w} GROUP BY categoria ORDER BY COUNT(*) DESC LIMIT 100`),
    pick(`SELECT concepto AS v FROM gastos ${w} GROUP BY concepto ORDER BY COUNT(*) DESC LIMIT 100`),
    all(env, `SELECT unidad AS v FROM (SELECT unidad FROM ingresos UNION ALL SELECT unidad FROM gastos) WHERE unidad IS NOT NULL GROUP BY unidad ORDER BY COUNT(*) DESC LIMIT 40`).then((r) => r.map((x) => x.v)),
  ]);
  return json({ clientes, conceptosIng, proveedores, categorias, conceptosGas, unidades });
});
