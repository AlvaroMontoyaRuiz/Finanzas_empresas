import { useEffect, useState } from 'react';
import { api, qs } from '../lib/api.js';
import { useApp } from '../App.jsx';
import { cop, num, downloadCsv, localToday } from '../lib/format.js';
import { Panel, PageHeader, Skeleton, EmpresaTag, IconDownload, IconAlert } from '../components/ui.jsx';

const TARIFA = { 0: '0 % (exento / excluido)', 5: '5 %', 19: '19 %' };

export default function Impuestos() {
  const { empresas } = useApp();
  const [anio, setAnio] = useState(localToday().slice(0, 4));
  const [empresa, setEmpresa] = useState(0);
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    setD(null);
    api.get('/api/impuestos' + qs({ anio, empresa })).then(setD).catch((e) => setErr(e.message));
  }, [anio, empresa]);

  const nombreEmp = empresa ? empresas.find((e) => e.id === empresa)?.nombre : 'todas';
  const bimHoy = localToday().slice(0, 4) === anio ? Math.ceil(Number(localToday().slice(5, 7)) / 2) : 0;
  const tot = d && d.bimestres.reduce((s, b) => ({ ingresos: s.ingresos + b.ingresos, base: s.base + b.base, iva: s.iva + b.iva, total: s.total + b.total, sin: s.sin + b.sin_iva }), { ingresos: 0, base: 0, iva: 0, total: 0, sin: 0 });

  async function exportarGastos() {
    const r = await api.get('/api/gastos' + qs({ desde: `${anio}-01-01`, hasta: `${anio}-12-31`, empresa, limit: 5000 }));
    downloadCsv(
      `gastos_${anio}_${nombreEmp}.csv`,
      ['Fecha', 'Bimestre', 'Empresa', 'Proveedor', 'NIT', 'Factura', 'Categoría', 'Concepto', 'Cantidad', 'Unidad', 'Precio unitario', 'Precio incluye IVA', 'Tarifa IVA %', 'Base', 'IVA', 'Total'],
      [...r.rows].reverse().map((g) => [
        g.fecha, Math.ceil(Number(g.fecha.slice(5, 7)) / 2), g.empresa, g.proveedor, g.nit, g.factura, g.categoria, g.concepto, g.cantidad, g.unidad,
        g.precio_unitario, g.precio_incluye_iva ? 'Sí' : 'No', g.iva_tarifa, g.base, g.iva, g.total,
      ])
    );
  }
  function exportarProveedores() {
    downloadCsv(`proveedores_${anio}_${nombreEmp}.csv`, ['Proveedor', 'NIT', 'Compras', 'Base', 'IVA', 'Total'], d.proveedores.map((p) => [p.proveedor, p.nit, p.n, p.base, p.iva, p.total]));
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Impuestos"
        subtitle="Resumen del IVA pagado en compras y de los ingresos, por bimestre, para preparar la declaración con el contador."
        action={
          <div className="flex gap-3">
            <select className="field !w-auto" value={anio} onChange={(e) => setAnio(e.target.value)} aria-label="Año">
              {(d?.anios || [anio]).map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
            <select className="field !w-auto" value={empresa} onChange={(e) => setEmpresa(Number(e.target.value))} aria-label="Empresa">
              <option value={0}>Todas las empresas</option>
              {empresas.map((e) => (
                <option key={e.id} value={e.id}>{e.nombre}</option>
              ))}
            </select>
          </div>
        }
      />

      {err && <p className="text-alert">No se pudo cargar: {err}</p>}
      {!d && !err && <Skeleton className="h-64" />}

      {d && (
        <>
          <div className="grid sm:grid-cols-2 2xl:grid-cols-4 gap-4 settle">
            <Tile label={`IVA pagado en ${anio}`} value={cop(tot.iva)} sub="IVA en compras (posible IVA descontable)" />
            <Tile label="Compras sin IVA (base)" value={cop(tot.base)} sub={`Total con IVA ${cop(tot.total)}`} />
            <Tile label="Compras exentas / sin IVA" value={cop(tot.sin)} sub="Gastos con tarifa 0 %" />
            <Tile label={`Ingresos ${anio}`} value={cop(tot.ingresos)} sub="Total vendido / facturado" />
          </div>

          {d.sinFactura.n > 0 && (
            <div className="rounded-2xl bg-warn-bg text-warn px-4 py-3 flex gap-3 items-start">
              <IconAlert className="shrink-0 mt-0.5" />
              <p>
                <b>{num(d.sinFactura.n)} {d.sinFactura.n === 1 ? 'gasto' : 'gastos'} sin número de factura</b> ({cop(d.sinFactura.total)}). Para descontar el IVA o
                deducir el gasto normalmente se necesita la factura electrónica: complétalos en <b>Gastos → Corregir</b>.
              </p>
            </div>
          )}

          <Panel
            title="Por bimestre"
            subtitle="El IVA se declara cada dos meses (o cada cuatro, según el régimen). Confírmalo con tu contador."
            action={
              <button className="btn btn-quiet !min-h-[40px] text-sm" onClick={exportarGastos}>
                <IconDownload /> Gastos del año (CSV)
              </button>
            }
          >
            <div className="rtable-wrap overflow-x-auto rounded-xl border border-line">
              <table className="rtable w-full text-[15px]">
                <thead className="bg-field text-left text-ink-soft">
                  <tr>
                    <th className="px-3 py-2 font-medium">Bimestre</th>
                    <th className="px-3 py-2 font-medium text-right">Ingresos</th>
                    <th className="px-3 py-2 font-medium text-right">Gastos base</th>
                    <th className="px-3 py-2 font-medium text-right">IVA pagado</th>
                    <th className="px-3 py-2 font-medium text-right">Gastos total</th>
                    <th className="px-3 py-2 font-medium text-right">Nº gastos</th>
                  </tr>
                </thead>
                <tbody>
                  {d.bimestres.map((b) => (
                    <tr key={b.bimestre} className={`border-t border-line ${b.bimestre === bimHoy ? 'bg-[#F4F8F2]' : ''}`}>
                      <td data-label="Bimestre" className="px-3 py-2 font-medium">
                        {b.bimestre}. {b.nombre} {b.bimestre === bimHoy && <span className="text-xs text-farm-green font-semibold ml-1">en curso</span>}
                      </td>
                      <td data-label="Ingresos" className="px-3 py-2 text-right">{cop(b.ingresos)}</td>
                      <td data-label="Gastos base" className="px-3 py-2 text-right">{cop(b.base)}</td>
                      <td data-label="IVA pagado" className="px-3 py-2 text-right font-semibold">{cop(b.iva)}</td>
                      <td data-label="Gastos total" className="px-3 py-2 text-right">{cop(b.total)}</td>
                      <td data-label="Nº gastos" className="px-3 py-2 text-right text-ink-soft">{num(b.n)}</td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-line font-bold bg-field">
                    <td data-label="" className="px-3 py-2">Total {anio}</td>
                    <td data-label="Ingresos" className="px-3 py-2 text-right">{cop(tot.ingresos)}</td>
                    <td data-label="Gastos base" className="px-3 py-2 text-right">{cop(tot.base)}</td>
                    <td data-label="IVA pagado" className="px-3 py-2 text-right">{cop(tot.iva)}</td>
                    <td data-label="Gastos total" className="px-3 py-2 text-right">{cop(tot.total)}</td>
                    <td data-label="" className="px-3 py-2" />
                  </tr>
                </tbody>
              </table>
            </div>
          </Panel>

          <div className="grid lg:grid-cols-2 gap-5">
            <Panel title="Por tarifa de IVA" subtitle="Gastos del año agrupados por tarifa">
              {d.porTarifa.length === 0 ? (
                <p className="text-ink-soft text-sm py-4 text-center">No hay gastos en {anio}.</p>
              ) : (
                <table className="w-full text-[15px]">
                  <thead className="text-left text-ink-soft text-sm">
                    <tr>
                      <th className="py-1.5 font-medium">Tarifa</th>
                      <th className="py-1.5 font-medium text-right">Base</th>
                      <th className="py-1.5 font-medium text-right">IVA</th>
                      <th className="py-1.5 font-medium text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.porTarifa.map((t) => (
                      <tr key={t.tarifa} className="border-t border-line">
                        <td className="py-2">{TARIFA[t.tarifa] || `${t.tarifa} %`} <span className="text-xs text-ink-faint">({num(t.n)})</span></td>
                        <td className="py-2 text-right">{cop(t.base)}</td>
                        <td className="py-2 text-right font-semibold">{cop(t.iva)}</td>
                        <td className="py-2 text-right">{cop(t.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Panel>

            <Panel title="Por empresa" subtitle={`Año ${anio}`}>
              <table className="w-full text-[15px]">
                <thead className="text-left text-ink-soft text-sm">
                  <tr>
                    <th className="py-1.5 font-medium">Empresa</th>
                    <th className="py-1.5 font-medium text-right">Ingresos</th>
                    <th className="py-1.5 font-medium text-right">Gastos base</th>
                    <th className="py-1.5 font-medium text-right">IVA</th>
                  </tr>
                </thead>
                <tbody>
                  {d.porEmpresa.map((e) => (
                    <tr key={e.id} className="border-t border-line">
                      <td className="py-2"><EmpresaTag nombre={e.nombre} color={e.color} /></td>
                      <td className="py-2 text-right">{cop(e.ingresos)}</td>
                      <td className="py-2 text-right">{cop(e.base)}</td>
                      <td className="py-2 text-right font-semibold">{cop(e.iva)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Panel>
          </div>

          <Panel
            title="Compras por proveedor"
            subtitle="Útil para la información exógena y para pedir certificados"
            action={
              <button className="btn btn-quiet !min-h-[40px] text-sm" onClick={exportarProveedores} disabled={!d.proveedores.length}>
                <IconDownload /> Descargar (CSV)
              </button>
            }
          >
            {d.proveedores.length === 0 ? (
              <p className="text-ink-soft text-sm py-4 text-center">No hay gastos en {anio}.</p>
            ) : (
              <div className="rtable-wrap overflow-x-auto rounded-xl border border-line max-h-[480px] overflow-y-auto">
                <table className="rtable w-full text-[15px]">
                  <thead className="bg-field text-left text-ink-soft sticky top-0">
                    <tr>
                      <th className="px-3 py-2 font-medium">Proveedor</th>
                      <th className="px-3 py-2 font-medium">NIT</th>
                      <th className="px-3 py-2 font-medium text-right">Compras</th>
                      <th className="px-3 py-2 font-medium text-right">Base</th>
                      <th className="px-3 py-2 font-medium text-right">IVA</th>
                      <th className="px-3 py-2 font-medium text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.proveedores.map((p) => (
                      <tr key={p.proveedor} className="border-t border-line">
                        <td data-label="Proveedor" className="px-3 py-2 font-medium">{p.proveedor}</td>
                        <td data-label="NIT" className="px-3 py-2">{p.nit || <span className="text-ink-faint">Sin NIT</span>}</td>
                        <td data-label="Compras" className="px-3 py-2 text-right">{num(p.n)}</td>
                        <td data-label="Base" className="px-3 py-2 text-right">{cop(p.base)}</td>
                        <td data-label="IVA" className="px-3 py-2 text-right">{cop(p.iva)}</td>
                        <td data-label="Total" className="px-3 py-2 text-right font-semibold">{cop(p.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          <p className="text-xs text-ink-faint">
            Estos números son una ayuda para organizar la información. Qué IVA se puede descontar y qué gastos son deducibles depende del régimen de cada empresa: confírmalo con tu contador.
          </p>
        </>
      )}
    </div>
  );
}

function Tile({ label, value, sub }) {
  return (
    <div className="bg-white rounded-2xl border border-line shadow-panel px-5 py-4">
      <div className="text-sm text-ink-soft">{label}</div>
      <div className="font-display font-bold text-[24px] leading-tight mt-1">{value}</div>
      {sub && <div className="text-sm text-ink-soft mt-0.5">{sub}</div>}
    </div>
  );
}
