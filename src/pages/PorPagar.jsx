import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, qs } from '../lib/api.js';
import { useApp } from '../App.jsx';
import { cop, shortDay, localToday, parseNum, downloadCsv } from '../lib/format.js';
import { Panel, PageHeader, Skeleton, Modal, ErrorBox, EmpresaTag, Segmented, IconPlus, IconDownload } from '../components/ui.jsx';
import { Field, NumberInput, EmpresaPicker, useSugerencias, DataList, lastEmpresa } from '../components/fields.jsx';
import ConfirmDelete from '../components/ConfirmDelete.jsx';
import AbonoForm from '../components/AbonoForm.jsx';
import CuentasTabs from '../components/CuentasTabs.jsx';

const changed = () => window.dispatchEvent(new Event('balance:changed'));

// Default company for supplier bills: the last one used, otherwise Carnicería.
function empresaInicial(empresas) {
  const last = lastEmpresa.get('pagar');
  if (last && empresas.some((e) => e.id === last)) return last;
  return (empresas.find((e) => e.slug === 'carniceria') || empresas[0])?.id;
}

function FacturaForm({ row, onSaved, onCancel }) {
  const { empresas } = useApp();
  const [f, setF] = useState(() => ({
    empresa_id: row?.empresa_id || empresaInicial(empresas),
    fecha: row?.fecha || localToday(),
    proveedor: row?.acreedor || '',
    factura: row?.factura || '',
    concepto: row?.concepto || '',
    monto: row ? String(row.monto) : '',
    abono_inicial: '',
    fecha_vencimiento: row?.fecha_vencimiento || '',
    nota: row?.nota || '',
  }));
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const sug = useSugerencias(f.empresa_id);
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v && v.target ? v.target.value : v }));
  const monto = parseNum(f.monto);
  const inicial = f.abono_inicial === '' ? 0 : parseNum(f.abono_inicial);
  const inicialMalo = !Number.isFinite(inicial) || inicial < 0 || (monto > 0 && inicial > monto);
  const ok = f.empresa_id && f.fecha && f.proveedor.trim() && monto > 0 && !inicialMalo;

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      const body = { ...f, monto, abono_inicial: inicial };
      if (row) await api.put(`/api/proveedores/${row.id}`, body);
      else await api.post('/api/proveedores', body);
      lastEmpresa.set('pagar', f.empresa_id);
      changed();
      onSaved();
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <Field label="Empresa">
        <EmpresaPicker empresas={empresas} value={f.empresa_id} onChange={set('empresa_id')} />
      </Field>
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Proveedor" htmlFor="f-prov">
          <input id="f-prov" className="field" list="dl-prov-pagar" value={f.proveedor} onChange={set('proveedor')} placeholder="Ej: Frigorífico Guadalupe" />
          <DataList id="dl-prov-pagar" items={sug.proveedores} />
        </Field>
        <Field label="Fecha de la factura" htmlFor="f-fecha">
          <input id="f-fecha" type="date" className="field" value={f.fecha} onChange={set('fecha')} />
        </Field>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="N.º de factura (opcional)" htmlFor="f-num">
          <input id="f-num" className="field" value={f.factura} onChange={set('factura')} placeholder="Ej: FE-1234" />
        </Field>
        <Field label="Qué se compró (opcional)" htmlFor="f-conc">
          <input id="f-conc" className="field" value={f.concepto} onChange={set('concepto')} placeholder="Ej: 2 reses en canal" />
        </Field>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Valor total de la factura" htmlFor="f-monto">
          <NumberInput id="f-monto" money value={f.monto} onChange={set('monto')} placeholder="0" />
        </Field>
        {!row ? (
          <Field label="Abono que diste hoy (opcional)" htmlFor="f-ini">
            <NumberInput id="f-ini" money value={f.abono_inicial} onChange={set('abono_inicial')} placeholder="0" />
          </Field>
        ) : (
          <Field label="Fecha límite de pago (opcional)" htmlFor="f-venc">
            <input id="f-venc" type="date" className="field" value={f.fecha_vencimiento} min={f.fecha} onChange={set('fecha_vencimiento')} />
          </Field>
        )}
      </div>
      {!row && monto > 0 && (
        <div className="rounded-xl bg-field px-4 py-3 flex items-center justify-between gap-3">
          <span className="text-ink-soft">Queda por pagar</span>
          <span className={`font-display font-bold text-xl ${inicialMalo ? 'text-alert' : 'text-warn'}`}>
            {inicialMalo ? 'El abono es mayor que la factura' : cop(monto - inicial)}
          </span>
        </div>
      )}
      <div className="grid sm:grid-cols-2 gap-4">
        {!row && (
          <Field label="Fecha límite de pago (opcional)" htmlFor="f-venc">
            <input id="f-venc" type="date" className="field" value={f.fecha_vencimiento} min={f.fecha} onChange={set('fecha_vencimiento')} />
          </Field>
        )}
        <Field label="Nota (opcional)" htmlFor="f-nota" className={row ? 'sm:col-span-2' : ''}>
          <input id="f-nota" className="field" value={f.nota} onChange={set('nota')} />
        </Field>
      </div>
      <ErrorBox>{err}</ErrorBox>
      <div className="grid grid-cols-2 gap-3 pt-1">
        <button type="button" className="btn btn-quiet" onClick={onCancel} disabled={busy}>Cancelar</button>
        <button className="btn btn-primary" disabled={busy || !ok}>{busy ? 'Guardando…' : row ? 'Guardar cambios' : 'Guardar factura'}</button>
      </div>
    </form>
  );
}

function Stat({ label, value, sub, tone }) {
  const c = tone === 'warn' ? 'text-warn' : tone === 'bad' ? 'text-alert' : 'text-ink';
  return (
    <div className="bg-white rounded-2xl border border-line shadow-panel p-4">
      <div className="text-sm text-ink-soft">{label}</div>
      <div className={`font-display font-bold text-2xl mt-1 ${c}`}>{value}</div>
      {sub && <div className="text-xs text-ink-soft mt-1">{sub}</div>}
    </div>
  );
}

export default function PorPagar() {
  const { empresas, user } = useApp();
  const [params, setParams] = useSearchParams();
  const [empresa, setEmpresa] = useState(0);
  const [estado, setEstado] = useState('abiertas');
  const [q, setQ] = useState('');
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [modal, setModal] = useState(null); // {kind:'factura'|'abono', row?}
  const [abiertos, setAbiertos] = useState({});

  const load = useCallback(() => {
    setErr('');
    api
      .get('/api/proveedores' + qs({ empresa, estado, q }))
      .then(setData)
      .catch((e) => setErr(e.message));
  }, [empresa, estado, q]);

  useEffect(() => {
    const t = setTimeout(load, q ? 300 : 0);
    window.addEventListener('balance:changed', load);
    return () => {
      clearTimeout(t);
      window.removeEventListener('balance:changed', load);
    };
  }, [load, q]);

  // "+ Nuevo" from the navigation opens the form directly (/por-pagar?nuevo=1)
  useEffect(() => {
    if (params.get('nuevo')) {
      setModal({ kind: 'factura' });
      params.delete('nuevo');
      setParams(params, { replace: true });
    }
  }, [params, setParams]);

  const canEdit = (r) => user.role === 'admin' || r.created_by === user.id;
  const close = () => setModal(null);
  const done = () => {
    setModal(null);
    load();
  };

  async function quitarAbono(r, g) {
    if (!window.confirm(`¿Quitar el abono de ${cop(g.monto)} del ${shortDay(g.fecha)}?`)) return;
    try {
      await api.del(`/api/proveedores/${r.id}/pago?pago=${g.id}`);
      changed();
    } catch (e) {
      setErr(e.message);
    }
  }

  function exportar() {
    downloadCsv(
      `facturas_proveedores_${localToday()}.csv`,
      ['Fecha', 'Empresa', 'Proveedor', 'Factura', 'Concepto', 'Valor', 'Abonado', 'Saldo', 'Fecha límite', 'Nota'],
      data.rows.map((r) => [r.fecha, r.empresa, r.acreedor, r.factura, r.concepto, r.monto, r.abonado, r.saldo, r.fecha_vencimiento, r.nota])
    );
  }

  const t = data?.totales;

  return (
    <div className="space-y-5">
      <CuentasTabs />
      <PageHeader
        title="Por pagar a proveedores"
        subtitle="Registra la factura, ve abonando cuando puedas y mira cuánto falta."
        action={
          <button className="btn btn-primary" onClick={() => setModal({ kind: 'factura' })}>
            <IconPlus /> Nueva factura
          </button>
        }
      />

      <Panel>
        <div className="flex flex-wrap items-end gap-3">
          <label className="block min-w-[170px]">
            <span className="label">Empresa</span>
            <select className="field" value={empresa} onChange={(e) => setEmpresa(Number(e.target.value))}>
              <option value={0}>Todas las empresas</option>
              {empresas.map((e) => (
                <option key={e.id} value={e.id}>{e.nombre}</option>
              ))}
            </select>
          </label>
          <label className="block flex-1 min-w-[200px]">
            <span className="label">Buscar</span>
            <input className="field" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Proveedor o n.º de factura" />
          </label>
          <div className="pb-1">
            <Segmented
              label="Estado"
              value={estado}
              onChange={setEstado}
              large
              options={[
                { value: 'abiertas', label: 'Por pagar' },
                { value: 'pagadas', label: 'Pagadas' },
                { value: 'todas', label: 'Todas' },
              ]}
            />
          </div>
        </div>
      </Panel>

      {err && <p className="text-alert text-sm">No se pudo cargar: {err}</p>}

      {!data ? (
        <Skeleton className="h-48" />
      ) : (
        <>
          <div className="grid grid-cols-1 min-[440px]:grid-cols-3 gap-3">
            <Stat label={estado === 'pagadas' ? 'Total pagado' : 'Total que debo'} value={cop(estado === 'pagadas' ? t.abonado : t.saldo)} tone={estado === 'pagadas' ? '' : 'warn'} sub={estado === 'pagadas' ? null : `de ${cop(t.monto)} en facturas`} />
            <Stat label="Facturas" value={t.n} sub={estado === 'abiertas' ? 'sin terminar de pagar' : null} />
            <Stat label="Vencidas" value={t.vencidas} tone={t.vencidas ? 'bad' : ''} sub={t.vencidas ? 'ya pasó la fecha límite' : 'ninguna vencida'} />
          </div>

          <div className="grid lg:grid-cols-[320px_1fr] gap-5 items-start">
            <Panel title="Por proveedor" subtitle="Lo que falta pagarle a cada uno.">
              {data.porProveedor.length === 0 ? (
                <p className="text-sm text-ink-soft py-2">No le debes nada a ningún proveedor.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {data.porProveedor.map((p) => (
                    <li key={p.nombre}>
                      <button type="button" className="w-full flex items-center justify-between gap-3 py-2.5 text-left hover:text-farm-green" onClick={() => setQ(p.nombre)}>
                        <span>
                          <b>{p.nombre}</b>
                          <span className="block text-xs text-ink-soft">{p.n} {p.n === 1 ? 'factura' : 'facturas'}</span>
                        </span>
                        <span className="font-display font-bold whitespace-nowrap">{cop(p.saldo)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel
              title="Facturas"
              subtitle={q ? `Filtrando por “${q}”` : 'La más reciente primero.'}
              action={
                <div className="flex gap-2">
                  {q && <button className="btn btn-quiet !min-h-[40px] text-sm" onClick={() => setQ('')}>Quitar filtro</button>}
                  <button className="btn btn-quiet !min-h-[40px] text-sm" onClick={exportar} disabled={!data.rows.length}><IconDownload /> Descargar</button>
                </div>
              }
            >
              {data.rows.length === 0 ? (
                <div className="text-center py-10 text-ink-soft">
                  <p>{estado === 'abiertas' ? 'No hay facturas pendientes por pagar.' : 'No hay facturas.'}</p>
                  <button className="btn btn-quiet mt-4" onClick={() => setModal({ kind: 'factura' })}><IconPlus /> Registrar una factura</button>
                </div>
              ) : (
                <ul className="space-y-3">
                  {data.rows.map((r) => {
                    const pct = Math.min(100, Math.round((r.abonado / r.monto) * 100));
                    return (
                      <li key={r.id} className="rounded-2xl border border-line p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <b className="text-[17px]">{r.acreedor}</b>
                              {r.factura && <span className="text-xs rounded-full bg-field px-2 py-0.5 text-ink-soft">Factura {r.factura}</span>}
                              {r.saldo <= 0 ? (
                                <span className="text-xs font-semibold rounded-full bg-[#E3EFE8] text-farm-green px-2 py-0.5">✓ Pagada</span>
                              ) : r.vencida ? (
                                <span className="text-xs font-semibold rounded-full bg-alert-bg text-alert px-2 py-0.5">! Vencida</span>
                              ) : null}
                            </div>
                            <div className="text-sm text-ink-soft mt-0.5">
                              {[r.concepto, shortDay(r.fecha), r.fecha_vencimiento ? `pagar antes del ${shortDay(r.fecha_vencimiento)}` : null].filter(Boolean).join(' · ')}
                            </div>
                            {!empresa && r.empresa && <div className="text-sm mt-1"><EmpresaTag nombre={r.empresa} color={r.empresa_color} /></div>}
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-xs text-ink-soft">{r.saldo > 0 ? 'Falta' : 'Valor'}</div>
                            <div className={`font-display font-bold text-xl ${r.saldo > 0 ? 'text-warn' : 'text-ingreso'}`}>{cop(r.saldo > 0 ? r.saldo : r.monto)}</div>
                          </div>
                        </div>
                        <div className="mt-3">
                          <div className="h-2 rounded-full bg-field overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Pagado">
                            <div className="h-full rounded-full bg-farm-green" style={{ width: `${pct}%` }} />
                          </div>
                          <div className="flex justify-between text-xs text-ink-soft mt-1">
                            <span>Abonado {cop(r.abonado)} ({pct} %)</span>
                            <span>Factura {cop(r.monto)}</span>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-3">
                          {r.saldo > 0 && (
                            <button type="button" className="btn btn-primary !min-h-[40px] !px-4 text-sm" onClick={() => setModal({ kind: 'abono', row: r })}>Abonar</button>
                          )}
                          {r.pagos.length > 0 && (
                            <button type="button" className="text-sm font-medium underline underline-offset-2 text-ink-soft min-h-[40px] px-1" onClick={() => setAbiertos((o) => ({ ...o, [r.id]: !o[r.id] }))}>
                              {abiertos[r.id] ? 'Ocultar abonos' : `Ver ${r.pagos.length} ${r.pagos.length === 1 ? 'abono' : 'abonos'}`}
                            </button>
                          )}
                          <span className="flex-1" />
                          {canEdit(r) && (
                            <>
                              <button type="button" className="text-sm underline underline-offset-2 text-ink-soft min-h-[40px] px-1" onClick={() => setModal({ kind: 'factura', row: r })}>Editar</button>
                              <ConfirmDelete table="pasivos" id={r.id} onDeleted={changed} />
                            </>
                          )}
                        </div>
                        {abiertos[r.id] && (
                          <ul className="mt-2 rounded-xl bg-field px-3 py-2 text-sm divide-y divide-line">
                            {r.pagos.map((g) => (
                              <li key={g.id} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
                                <span>{shortDay(g.fecha)} · <b>{cop(g.monto)}</b>{g.nota ? ` · ${g.nota}` : ''}</span>
                                {(user.role === 'admin' || g.created_by === user.id) && (
                                  <button type="button" className="btn-link-danger" onClick={() => quitarAbono(r, g)}>Quitar</button>
                                )}
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </Panel>
          </div>
        </>
      )}

      {modal?.kind === 'factura' && (
        <Modal title={modal.row ? 'Editar factura' : 'Nueva factura de proveedor'} onClose={close} wide>
          <FacturaForm row={modal.row} onSaved={done} onCancel={close} />
        </Modal>
      )}
      {modal?.kind === 'abono' && (
        <Modal title="Registrar abono" onClose={close}>
          <AbonoForm row={modal.row} url={`/api/proveedores/${modal.row.id}/pago`} onSaved={done} onCancel={close} />
        </Modal>
      )}
    </div>
  );
}
