import { useCallback, useEffect, useState } from 'react';
import { api, qs } from '../lib/api.js';
import { useApp } from '../App.jsx';
import { cop, num, shortDay, medioLabel, downloadCsv, localToday } from '../lib/format.js';
import { Panel, PageHeader, Filtros, initialFiltro, Skeleton, Modal, EmpresaTag, EstadoBadge, IconPlus, IconDownload } from '../components/ui.jsx';
import IngresoForm from '../components/IngresoForm.jsx';
import PagoButton from '../components/Pago.jsx';
import ConfirmDelete from '../components/ConfirmDelete.jsx';

export default function Ingresos() {
  const { empresas, user } = useApp();
  const [filtro, setFiltro] = useState(() => initialFiltro('mes'));
  const [estado, setEstado] = useState('');
  const [q, setQ] = useState('');
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [editing, setEditing] = useState(null); // null | 'new' | row

  const load = useCallback(() => {
    setErr('');
    api
      .get('/api/ingresos' + qs({ desde: filtro.desde, hasta: filtro.hasta, empresa: filtro.empresa, estado, q }))
      .then(setData)
      .catch((e) => setErr(e.message));
  }, [filtro, estado, q]);

  useEffect(() => {
    const t = setTimeout(load, q ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  const algunaCobra = empresas.some((e) => e.cobra_pendientes);
  const cobraDe = (id) => !!empresas.find((e) => e.id === id)?.cobra_pendientes;
  const canEdit = (r) => user.role === 'admin' || r.created_by === user.id;
  const hoy = localToday();

  function exportar() {
    downloadCsv(
      `ingresos_${filtro.desde}_${filtro.hasta}.csv`,
      ['Fecha', 'Empresa', 'Cliente', 'Concepto', 'Cantidad', 'Unidad', 'Precio unitario', 'Total', 'Estado', 'Fecha de pago', 'Fecha límite', 'Medio de pago', 'Nota', 'Registró'],
      data.rows.map((r) => [
        r.fecha, r.empresa, r.cliente, r.concepto, r.cantidad, r.unidad, r.precio_unitario, r.total,
        r.estado === 'pendiente' ? 'Pendiente' : 'Pagado', r.fecha_pago, r.fecha_vencimiento, medioLabel(r.medio_pago), r.nota, r.creado_por,
      ])
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Ingresos"
        subtitle="Todo lo que entra a las empresas: cuánto, de quién, de dónde y cuándo."
        action={
          <button className="btn btn-primary" onClick={() => setEditing('new')}>
            <IconPlus /> Nuevo ingreso
          </button>
        }
      />

      <Panel>
        <Filtros value={filtro} onChange={setFiltro} empresas={empresas}>
          {algunaCobra && (
            <label className="block min-w-[150px]">
              <span className="label">Estado</span>
              <select className="field" value={estado} onChange={(e) => setEstado(e.target.value)}>
                <option value="">Todos</option>
                <option value="pagado">Pagados</option>
                <option value="pendiente">Pendientes</option>
              </select>
            </label>
          )}
          <label className="block flex-1 min-w-[200px]">
            <span className="label">Buscar</span>
            <input className="field" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cliente, concepto o nota" />
          </label>
        </Filtros>

        {data && (
          <div className="flex flex-wrap items-center justify-between gap-3 mt-5 mb-3">
            <div className="flex flex-wrap gap-x-6 gap-y-1">
              <span><span className="text-ink-soft">Registros:</span> <b>{num(data.totales.n)}</b></span>
              <span><span className="text-ink-soft">Total:</span> <b className="text-ingreso">{cop(data.totales.total)}</b></span>
              {data.totales.pendiente > 0 && (
                <span><span className="text-ink-soft">Por cobrar:</span> <b className="text-warn">{cop(data.totales.pendiente)}</b></span>
              )}
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
          <p className="text-ink-soft py-10 text-center">No hay ingresos con estos filtros.</p>
        ) : data ? (
          <div className="rtable-wrap overflow-x-auto rounded-xl border border-line">
            <table className="rtable w-full text-[15px] min-w-[980px]">
              <thead className="bg-field text-left text-ink-soft">
                <tr>
                  <th className="px-3 py-2 font-medium">Fecha</th>
                  <th className="px-3 py-2 font-medium">Empresa</th>
                  <th className="px-3 py-2 font-medium">Cliente</th>
                  <th className="px-3 py-2 font-medium">Concepto</th>
                  <th className="px-3 py-2 font-medium text-right">Cantidad</th>
                  <th className="px-3 py-2 font-medium text-right">Precio unit.</th>
                  <th className="px-3 py-2 font-medium text-right">Total</th>
                  <th className="px-3 py-2 font-medium">Pago</th>
                  <th className="px-3 py-2 font-medium"><span className="sr-only">Acciones</span></th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r) => (
                  <tr key={r.id} className="border-t border-line align-middle">
                    <td data-label="Fecha" className="px-3 py-2 whitespace-nowrap">{shortDay(r.fecha)}</td>
                    <td data-label="Empresa" className="px-3 py-2"><EmpresaTag nombre={r.empresa} color={r.empresa_color} /></td>
                    <td data-label="Cliente" className="px-3 py-2 font-medium">{r.cliente}</td>
                    <td data-label="Concepto" className="px-3 py-2">
                      {r.concepto}
                      {r.nota && <div className="text-xs text-ink-faint">{r.nota}</div>}
                    </td>
                    <td data-label="Cantidad" className="px-3 py-2 text-right whitespace-nowrap">{num(r.cantidad)} {r.unidad || ''}</td>
                    <td data-label="Precio unit." className="px-3 py-2 text-right whitespace-nowrap">{cop(r.precio_unitario)}</td>
                    <td data-label="Total" className="px-3 py-2 text-right font-semibold whitespace-nowrap">{cop(r.total)}</td>
                    <td data-label="Pago" className="px-3 py-2">
                      {r.estado === 'pendiente' ? (
                        <div className="flex flex-col items-start gap-1">
                          <EstadoBadge estado="pendiente" vencido={r.fecha_vencimiento && r.fecha_vencimiento < hoy} />
                          {r.fecha_vencimiento && <span className="text-xs text-ink-soft">Límite {shortDay(r.fecha_vencimiento)}</span>}
                        </div>
                      ) : (
                        <span className="text-sm text-ink-soft whitespace-nowrap">
                          {cobraDe(r.empresa_id) ? <EstadoBadge estado="pagado" /> : medioLabel(r.medio_pago) || '—'}
                          {cobraDe(r.empresa_id) && r.fecha_pago && r.fecha_pago !== r.fecha && <span className="block text-xs mt-0.5">el {shortDay(r.fecha_pago)}</span>}
                        </span>
                      )}
                    </td>
                    <td data-label="" className="px-3 py-2">
                      <div className="flex items-center justify-end gap-1 flex-wrap">
                        {r.estado === 'pendiente' && <PagoButton row={r} onDone={load} />}
                        {canEdit(r) && (
                          <>
                            <button className="text-farm-green font-medium text-sm underline underline-offset-2 px-2 min-h-[40px]" onClick={() => setEditing(r)}>
                              Corregir
                            </button>
                            <ConfirmDelete table="ingresos" id={r.id} onDeleted={() => { load(); window.dispatchEvent(new Event('ingresos:changed')); }} />
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </Panel>

      {editing && (
        <Modal wide title={editing === 'new' ? 'Nuevo ingreso' : 'Corregir ingreso'} onClose={() => setEditing(null)}>
          <IngresoForm
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
