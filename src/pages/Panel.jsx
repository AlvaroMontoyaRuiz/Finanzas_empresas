import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, qs } from '../lib/api.js';
import { useApp } from '../App.jsx';
import { cop, num, shortDay, daysSince, COLOR_INGRESO, COLOR_GASTO } from '../lib/format.js';
import { Panel as Card, PageHeader, Filtros, initialFiltro, Skeleton, IconUp, IconDown } from '../components/ui.jsx';
import { IngresosGastosMes, BarList, PorEmpresa } from '../components/charts.jsx';

export default function Panel() {
  const { empresas } = useApp();
  const [filtro, setFiltro] = useState(() => initialFiltro('anio'));
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    setErr('');
    api
      .get('/api/dashboard' + qs({ desde: filtro.desde, hasta: filtro.hasta, empresa: filtro.empresa }))
      .then(setD)
      .catch((e) => setErr(e.message));
  }, [filtro]);

  const emp = empresas.find((e) => e.id === filtro.empresa);
  const cartera = emp ? !!emp.cobra_pendientes : empresas.some((e) => e.cobra_pendientes);
  const margen = d && d.ingresos.total > 0 ? (d.utilidad / d.ingresos.total) * 100 : null;

  return (
    <div className="space-y-5">
      <PageHeader
        title={emp ? `Panel · ${emp.nombre}` : 'Panel general'}
        subtitle={d ? `Del ${shortDay(d.desde)} al ${shortDay(d.hasta)}` : 'Cómo se mueve el dinero de las empresas'}
      />

      <Card>
        <Filtros value={filtro} onChange={setFiltro} empresas={empresas} />
      </Card>

      {err && <p className="text-alert">No se pudo cargar el panel: {err}</p>}
      {!d && !err && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)}
        </div>
      )}

      {d && (
        <>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 settle">
            <Kpi label="Ingresos" value={d.ingresos.total} prev={d.anterior.ingresos} accent={COLOR_INGRESO} sub={`${num(d.ingresos.n)} registros`} />
            <Kpi label="Gastos" value={d.gastos.total} prev={d.anterior.gastos} accent={COLOR_GASTO} upIsBad sub={`IVA pagado ${cop(d.gastos.iva)}`} />
            <Kpi
              label="Utilidad"
              value={d.utilidad}
              prev={d.anterior.utilidad}
              accent="#17261D"
              negative={d.utilidad < 0}
              sub={margen != null ? `Margen ${num(Math.round(margen))} %` : 'Sin ingresos'}
            />
            {cartera ? (
              <Link to="/por-cobrar" className="block bg-white rounded-2xl border border-line shadow-panel px-5 py-4 hover:border-ink-faint">
                <div className="text-sm text-ink-soft">Por cobrar hoy</div>
                <div className="font-display font-bold text-[26px] leading-tight mt-1 text-warn">{cop(d.cartera.total)}</div>
                <div className="text-sm text-ink-soft mt-0.5">
                  {d.cartera.n === 0 ? 'Todo cobrado' : `${num(d.cartera.n)} ${d.cartera.n === 1 ? 'venta pendiente' : 'ventas pendientes'} →`}
                </div>
              </Link>
            ) : (
              <Kpi label="Cobrado" value={d.ingresos.cobrado} accent={COLOR_INGRESO} sub="Ingresos ya pagados" />
            )}
          </div>
          <p className="text-xs text-ink-faint -mt-2">
            Flechas: comparación con el periodo anterior del mismo largo ({shortDay(d.anterior.desde)} – {shortDay(d.anterior.hasta)}).
          </p>

          <Card title="Ingresos y gastos por mes" subtitle="Pasa el dedo o el mouse por una barra para ver la utilidad del mes">
            <IngresosGastosMes data={d.porMes} />
          </Card>

          <div className="grid lg:grid-cols-2 gap-5">
            <Card title="Por empresa" subtitle="Ingresos, gastos y utilidad de cada negocio en el periodo">
              <PorEmpresa rows={d.porEmpresa} selected={filtro.empresa} onPick={(id) => setFiltro((f) => ({ ...f, empresa: id }))} />
            </Card>
            <Card title="¿En qué se gasta?" subtitle="Gastos por categoría (con IVA)">
              <BarList items={d.categorias.map((r) => ({ nombre: r.nombre, v: r.v }))} color={COLOR_GASTO} empty="No hay gastos en este periodo." />
            </Card>
          </div>

          <div className="grid lg:grid-cols-3 gap-5">
            <Card title="Mejores clientes" subtitle="Quién genera más ingresos">
              <BarList items={d.clientes.map((r) => ({ nombre: r.nombre, v: r.v, sub: `${num(r.n)} ${r.n === 1 ? 'venta' : 'ventas'}` }))} color={COLOR_INGRESO} empty="No hay ingresos en este periodo." />
            </Card>
            <Card title="¿De dónde viene el dinero?" subtitle="Ingresos por concepto">
              <BarList
                items={d.conceptos.map((r) => ({ nombre: r.nombre, v: r.v, sub: r.unidad ? `${num(r.cantidad)} ${r.unidad}` : `${num(r.n)} registros` }))}
                color={COLOR_INGRESO}
                empty="No hay ingresos en este periodo."
              />
            </Card>
            <Card title="Principales proveedores" subtitle="A quién se le paga más">
              <BarList items={d.proveedores.map((r) => ({ nombre: r.nombre, v: r.v, sub: `${num(r.n)} ${r.n === 1 ? 'compra' : 'compras'}` }))} color={COLOR_GASTO} empty="No hay gastos en este periodo." />
            </Card>
          </div>

          {cartera && d.cartera.n > 0 && (
            <Card title="Cartera por antigüedad" subtitle="Ventas pendientes por cobrar, según cuántos días llevan" action={<Link to="/por-cobrar" className="text-farm-green font-semibold underline underline-offset-2 text-sm min-h-[40px] inline-flex items-center">Ver todo</Link>}>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {d.cartera.buckets.map((b, i) => (
                  <div key={b.label} className={`rounded-xl px-4 py-3 ${i >= 2 && b.n ? 'bg-alert-bg' : 'bg-field'}`}>
                    <div className="text-sm text-ink-soft">{b.label}</div>
                    <div className={`font-display font-bold text-lg ${i >= 2 && b.n ? 'text-alert' : ''}`}>{cop(b.total)}</div>
                    <div className="text-xs text-ink-soft">{num(b.n)} {b.n === 1 ? 'venta' : 'ventas'}</div>
                  </div>
                ))}
              </div>
              <ul className="divide-y divide-line mt-4">
                {d.cartera.lista.map((r) => (
                  <li key={r.id} className="py-2.5 flex items-center justify-between gap-3">
                    <div>
                      <span className="font-medium">{r.cliente || r.concepto}</span>
                      <span className="text-sm text-ink-soft">{r.cliente ? ` · ${r.concepto}` : r.nota ? ` · ${r.nota}` : ''} · {shortDay(r.fecha)} (hace {daysSince(r.fecha)} días)</span>
                    </div>
                    <span className="font-semibold whitespace-nowrap">{cop(r.total)}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function Kpi({ label, value, prev, accent, sub, upIsBad = false, negative = false }) {
  let delta = null;
  if (prev != null && prev !== 0) delta = ((value - prev) / Math.abs(prev)) * 100;
  const up = delta != null && delta > 0;
  const good = delta == null || delta === 0 ? null : upIsBad ? !up : up;
  return (
    <div className="bg-white rounded-2xl border border-line shadow-panel px-5 py-4 relative overflow-hidden">
      <span className="absolute left-0 top-0 bottom-0 w-1" style={{ background: accent }} aria-hidden />
      <div className="text-sm text-ink-soft">{label}</div>
      <div className={`font-display font-bold text-[26px] leading-tight mt-1 ${negative ? 'text-alert' : ''}`}>{cop(value)}</div>
      <div className="flex items-center gap-2 mt-0.5 text-sm">
        {delta != null && Math.abs(delta) >= 0.5 && (
          <span className={`inline-flex items-center font-semibold ${good ? 'text-farm-green' : 'text-alert'}`}>
            {up ? <IconUp width={16} height={16} /> : <IconDown width={16} height={16} />}
            {num(Math.round(Math.abs(delta)))} %
            <span className="sr-only">{up ? 'más' : 'menos'} que el periodo anterior</span>
          </span>
        )}
        {sub && <span className="text-ink-soft">{sub}</span>}
      </div>
    </div>
  );
}
