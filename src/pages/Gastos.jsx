import { useCallback, useEffect, useState } from 'react';
import { api, qs } from '../lib/api.js';
import { useApp } from '../App.jsx';
import { cop, num, shortDay, medioLabel, downloadCsv } from '../lib/format.js';
import { Panel, PageHeader, Filtros, initialFiltro, Skeleton, Modal, EmpresaTag, IconPlus, IconDownload } from '../components/ui.jsx';
import GastoForm from '../components/GastoForm.jsx';
import ConfirmDelete from '../components/ConfirmDelete.jsx';

export default function Gastos() {
  const { empresas, user } = useApp();
  const [filtro, setFiltro] = useState(() => initialFiltro('mes'));
  const [iva, setIva] = useState('');
  const [q, setQ] = useState('');
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [editing, setEditing] = useState(null);

  const load = useCallback(() => {
    setErr('');
    api
      .get('/api/gastos' + qs({ desde: filtro.desde, hasta: filtro.hasta, empresa: filtro.empresa, iva, q }))
      .then(setData)
      .catch((e) => setErr(e.message));
  }, [filtro, iva, q]);

  useEffect(() => {
    const t = setTimeout(load, q ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  const canEdit = (r) => user.role === 'admin' || r.created_by === user.id;

  function exportar() {
    downloadCsv(
      `gastos_${filtro.desde}_${filtro.hasta}.csv`,
      ['Fecha', 'Empresa', 'Proveedor', 'NIT', 'Factura', 'Categoría', 'Concepto', 'Cantidad', 'Unidad', 'Precio unitario', 'Precio incluye IVA', 'Tarifa IVA %', 'Base', 'IVA', 'Total', 'Medio de pago', 'Nota', 'Registró'],
      data.rows.map((r) => [
        r.fecha, r.empresa, r.proveedor, r.nit, r.factura, r.categoria, r.concepto, r.cantidad, r.unidad, r.precio_unitario,
        r.precio_incluye_iva ? 'Sí' : 'No', r.iva_tarifa, r.base, r.iva, r.total, medioLabel(r.medio_pago), r.nota, r.creado_por,
      ])
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Gastos"
        subtitle="Todo lo que se paga, con el IVA separado para la declaración."
        action={
          <button className="btn btn-primary" onClick={() => setEditing('new')}>
            <IconPlus /> Nuevo gasto
          </button>
        }
      />

      <Panel>
        <Filtros value={filtro} onChange={setFiltro} empresas={empresas}>
          <label className="block min-w-[150px]">
            <span className="label">IVA</span>
            <select className="field" value={iva} onChange={(e) => setIva(e.target.value)}>
              <option value="">Todos</option>
              <option value="con">Con IVA</option>
              <option value="sin">Sin IVA</option>
            </select>
          </label>
          <label className="block flex-1 min-w-[200px]">
            <span className="label">Buscar</span>
            <input className="field" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Proveedor, NIT, factura o concepto" />
          </label>
        </Filtros>

        {data && (
          <div className="flex flex-wrap items-center justify-between gap-3 mt-5 mb-3">
            <div className="flex flex-wrap gap-x-6 gap-y-1">
              <span><span className="text-ink-soft">Registros:</span> <b>{num(data.totales.n)}</b></span>
              <span><span className="text-ink-soft">Base:</span> <b>{cop(data.totales.base)}</b></span>
              <span><span className="text-ink-soft">IVA:</span> <b>{cop(data.totales.iva)}</b></span>
              <span><span className="text-ink-soft">Total:</span> <b className="text-gasto">{cop(data.totales.total)}</b></span>
            </div>
            <button className="btn btn-quiet !min-h-[40px] text-sm" onClick={exportar} disabled={!data.rows.length}>
              <IconDownload /> Descargar Excel (CSV)
            </button>
          </div>
        )}

        {err && <p className="text-alert text-sm mt-4">No se pudo cargar: {err}</p>}
        {!data && !err ? (
          <Skeleton className="h-48 mt-5" />
        ) : data && data.rows.length === 0 ? (
          <p className="text-ink-soft py-10 text-center">No hay gastos con estos filtros.</p>
        ) : data ? (
          <div className="rtable-wrap overflow-x-auto rounded-xl border border-line">
            <table className="rtable w-full text-[15px] min-w-[1080px]">
              <thead className="bg-field text-left text-ink-soft">
                <tr>
                  <th className="px-3 py-2 font-medium">Fecha</th>
                  <th className="px-3 py-2 font-medium">Empresa</th>
                  <th className="px-3 py-2 font-medium">Proveedor</th>
                  <th className="px-3 py-2 font-medium">Categoría / concepto</th>
                  <th className="px-3 py-2 font-medium text-right">Cantidad</th>
                  <th className="px-3 py-2 font-medium text-right">Base</th>
                  <th className="px-3 py-2 font-medium text-right">IVA</th>
                  <th className="px-3 py-2 font-medium text-right">Total</th>
                  <th className="px-3 py-2 font-medium"><span className="sr-only">Acciones</span></th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r) => (
                  <tr key={r.id} className="border-t border-line align-middle">
                    <td data-label="Fecha" className="px-3 py-2 whitespace-nowrap">{shortDay(r.fecha)}</td>
                    <td data-label="Empresa" className="px-3 py-2"><EmpresaTag nombre={r.empresa} color={r.empresa_color} /></td>
                    <td data-label="Proveedor" className="px-3 py-2">
                      <span className="font-medium">{r.proveedor}</span>
                      {(r.nit || r.factura) && (
                        <div className="text-xs text-ink-faint">
                          {r.nit && <>NIT {r.nit}</>}
                          {r.nit && r.factura && ' · '}
                          {r.factura && <>Fact. {r.factura}</>}
                        </div>
                      )}
                    </td>
                    <td data-label="Concepto" className="px-3 py-2">
                      <span className="text-xs font-semibold text-ink-soft uppercase tracking-wide">{r.categoria}</span>
                      <div>{r.concepto}</div>
                    </td>
                    <td data-label="Cantidad" className="px-3 py-2 text-right whitespace-nowrap">
                      {num(r.cantidad)} {r.unidad || ''}
                      <div className="text-xs text-ink-faint">× {cop(r.precio_unitario)} {r.precio_incluye_iva ? 'con IVA' : 'sin IVA'}</div>
                    </td>
                    <td data-label="Base" className="px-3 py-2 text-right whitespace-nowrap">{cop(r.base)}</td>
                    <td data-label="IVA" className="px-3 py-2 text-right whitespace-nowrap">
                      {r.iva > 0 ? cop(r.iva) : <span className="text-ink-faint">—</span>}
                      <div className="text-xs text-ink-faint">{num(r.iva_tarifa)} %</div>
                    </td>
                    <td data-label="Total" className="px-3 py-2 text-right font-semibold whitespace-nowrap">{cop(r.total)}</td>
                    <td data-label="" className="px-3 py-2">
                      {canEdit(r) && (
                        <div className="flex items-center justify-end gap-1">
                          <button className="text-farm-green font-medium text-sm underline underline-offset-2 px-2 min-h-[40px]" onClick={() => setEditing(r)}>
                            Corregir
                          </button>
                          <ConfirmDelete table="gastos" id={r.id} onDeleted={load} />
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </Panel>

      {editing && (
        <Modal wide title={editing === 'new' ? 'Nuevo gasto' : 'Corregir gasto'} onClose={() => setEditing(null)}>
          <GastoForm
            row={editing === 'new' ? null : editing}
            onCancel={() => setEditing(null)}
            onSaved={() => {
              setEditing(null);
              load();
            }}
          />
        </Modal>
      )}
    </div>
  );
}
