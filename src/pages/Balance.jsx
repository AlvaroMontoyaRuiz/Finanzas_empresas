import { Fragment, useCallback, useEffect, useState } from 'react';
import { api, qs } from '../lib/api.js';
import { useApp } from '../App.jsx';
import { cop, shortDay, localToday, parseNum, TIPOS_ACTIVO, downloadCsv } from '../lib/format.js';
import { Panel, PageHeader, Filtros, initialFiltro, Skeleton, Modal, ErrorBox, EmpresaTag, IconPlus, IconDownload } from '../components/ui.jsx';
import { Field, NumberInput } from '../components/fields.jsx';
import ConfirmDelete from '../components/ConfirmDelete.jsx';
import AbonoForm from '../components/AbonoForm.jsx';
import { Link } from 'react-router-dom';

const refresh = () => window.dispatchEvent(new Event('balance:changed'));

function Tile({ label, value, sub, tone = '', big = false }) {
  const color = tone === 'good' ? 'text-ingreso' : tone === 'bad' ? 'text-alert' : tone === 'warn' ? 'text-warn' : 'text-ink';
  return (
    <div className="bg-white rounded-2xl border border-line shadow-panel p-4">
      <div className="text-sm text-ink-soft">{label}</div>
      <div className={`font-display font-bold ${big ? 'text-2xl sm:text-3xl' : 'text-xl sm:text-2xl'} mt-1 break-words ${color}`}>{value}</div>
      {sub && <div className="text-xs text-ink-soft mt-1">{sub}</div>}
    </div>
  );
}

const empresaSelect = (empresas, value, onChange) => (
  <select className="field" value={value} onChange={(e) => onChange(e.target.value)}>
    <option value="">Sin empresa (general)</option>
    {empresas.map((e) => (
      <option key={e.id} value={e.id}>{e.nombre}</option>
    ))}
  </select>
);

/* ---------- Pasivo (deuda con una persona) ---------- */
function PasivoForm({ row, onSaved, onCancel }) {
  const { empresas } = useApp();
  const [f, setF] = useState({
    fecha: row?.fecha || localToday(),
    acreedor: row?.acreedor || '',
    concepto: row?.concepto || '',
    monto: row ? String(row.monto) : '',
    empresa_id: row?.empresa_id ? String(row.empresa_id) : '',
    fecha_vencimiento: row?.fecha_vencimiento || '',
    nota: row?.nota || '',
  });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e && e.target ? e.target.value : e }));
  const monto = parseNum(f.monto);
  const ok = f.acreedor.trim() && f.concepto.trim() && monto > 0 && f.fecha;

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      const body = { ...f, monto, empresa_id: f.empresa_id || null };
      if (row) await api.put(`/api/pasivos/${row.id}`, body);
      else await api.post('/api/pasivos', body);
      refresh();
      onSaved();
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="¿A quién se le debe?" htmlFor="p-acreedor">
          <input id="p-acreedor" className="field" value={f.acreedor} onChange={set('acreedor')} placeholder="Ej: Don Jorge Pérez" />
        </Field>
        <Field label="Fecha en que se adquirió la deuda" htmlFor="p-fecha">
          <input id="p-fecha" type="date" className="field" value={f.fecha} onChange={set('fecha')} />
        </Field>
      </div>
      <Field label="Concepto" htmlFor="p-concepto" hint="Por qué se debe: préstamo, compra a crédito, etc.">
        <input id="p-concepto" className="field" value={f.concepto} onChange={set('concepto')} placeholder="Ej: Préstamo para compra de ganado" />
      </Field>
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Valor de la deuda" htmlFor="p-monto">
          <NumberInput id="p-monto" money value={f.monto} onChange={set('monto')} placeholder="0" />
        </Field>
        <Field label="Fecha límite de pago (opcional)" htmlFor="p-venc">
          <input id="p-venc" type="date" className="field" value={f.fecha_vencimiento} min={f.fecha} onChange={set('fecha_vencimiento')} />
        </Field>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Empresa (opcional)" htmlFor="p-emp">
          {empresaSelect(empresas, f.empresa_id, (v) => setF((x) => ({ ...x, empresa_id: v })))}
        </Field>
        <Field label="Nota (opcional)" htmlFor="p-nota">
          <input id="p-nota" className="field" value={f.nota} onChange={set('nota')} placeholder="Ej: interés 1 % mensual" />
        </Field>
      </div>
      <ErrorBox>{err}</ErrorBox>
      <div className="grid grid-cols-2 gap-3 pt-1">
        <button type="button" className="btn btn-quiet" onClick={onCancel} disabled={busy}>Cancelar</button>
        <button className="btn btn-primary" disabled={busy || !ok}>{busy ? 'Guardando…' : row ? 'Guardar cambios' : 'Guardar deuda'}</button>
      </div>
    </form>
  );
}


/* ---------- Activo manual ---------- */
function ActivoForm({ row, onSaved, onCancel }) {
  const { empresas } = useApp();
  const [f, setF] = useState({
    fecha: row?.fecha || localToday(),
    tipo: row?.tipo || TIPOS_ACTIVO[0],
    descripcion: row?.descripcion || '',
    valor: row ? String(row.valor) : '',
    empresa_id: row?.empresa_id ? String(row.empresa_id) : '',
    nota: row?.nota || '',
  });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e && e.target ? e.target.value : e }));
  const valor = parseNum(f.valor);
  const ok = f.descripcion.trim() && Number.isFinite(valor) && valor >= 0 && f.valor !== '';

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      const body = { ...f, valor, empresa_id: f.empresa_id || null };
      if (row) await api.put(`/api/activos/${row.id}`, body);
      else await api.post('/api/activos', body);
      refresh();
      onSaved();
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Tipo de activo" htmlFor="ac-tipo">
          <select id="ac-tipo" className="field" value={f.tipo} onChange={set('tipo')}>
            {TIPOS_ACTIVO.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </Field>
        <Field label="Fecha del valor" htmlFor="ac-fecha">
          <input id="ac-fecha" type="date" className="field" value={f.fecha} onChange={set('fecha')} />
        </Field>
      </div>
      <Field label="Descripción" htmlFor="ac-desc">
        <input id="ac-desc" className="field" value={f.descripcion} onChange={set('descripcion')} placeholder="Ej: Camión Chevrolet NPR, 40 reses, saldo Bancolombia" />
      </Field>
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Valor actual" htmlFor="ac-valor">
          <NumberInput id="ac-valor" money value={f.valor} onChange={set('valor')} placeholder="0" />
        </Field>
        <Field label="Empresa (opcional)" htmlFor="ac-emp">
          {empresaSelect(empresas, f.empresa_id, (v) => setF((x) => ({ ...x, empresa_id: v })))}
        </Field>
      </div>
      <Field label="Nota (opcional)" htmlFor="ac-nota">
        <input id="ac-nota" className="field" value={f.nota} onChange={set('nota')} />
      </Field>
      <ErrorBox>{err}</ErrorBox>
      <div className="grid grid-cols-2 gap-3">
        <button type="button" className="btn btn-quiet" onClick={onCancel} disabled={busy}>Cancelar</button>
        <button className="btn btn-primary" disabled={busy || !ok}>{busy ? 'Guardando…' : row ? 'Guardar cambios' : 'Guardar activo'}</button>
      </div>
    </form>
  );
}

/* ---------- Page ---------- */
export default function Balance() {
  const { empresas } = useApp();
  const [filtro, setFiltro] = useState(() => initialFiltro('anio'));
  const [bal, setBal] = useState(null);
  const [pas, setPas] = useState(null);
  const [act, setAct] = useState(null);
  const [verPag, setVerPag] = useState('abiertas');
  const [err, setErr] = useState('');
  const [modal, setModal] = useState(null); // {kind:'pasivo'|'abono'|'activo', row?}
  const [abiertos, setAbiertos] = useState({}); // pasivo ids with the abonos list open

  const load = useCallback(() => {
    setErr('');
    const emp = filtro.empresa;
    Promise.all([
      api.get('/api/balance' + qs({ desde: filtro.desde, hasta: filtro.hasta, empresa: emp })),
      api.get('/api/pasivos' + qs({ empresa: emp, estado: verPag })),
      api.get('/api/activos' + qs({ empresa: emp })),
    ])
      .then(([b, p, a]) => {
        setBal(b);
        setPas(p);
        setAct(a);
      })
      .catch((e) => setErr(e.message));
  }, [filtro, verPag]);

  useEffect(() => {
    load();
    window.addEventListener('balance:changed', load);
    window.addEventListener('ingresos:changed', load);
    return () => {
      window.removeEventListener('balance:changed', load);
      window.removeEventListener('ingresos:changed', load);
    };
  }, [load]);

  const close = () => setModal(null);
  const done = () => {
    setModal(null);
    load();
  };

  async function quitarAbono(p, g) {
    if (!window.confirm(`¿Quitar el abono de ${cop(g.monto)} del ${shortDay(g.fecha)}?`)) return;
    try {
      await api.del(`/api/pasivos/${p.id}/pago?pago=${g.id}`);
      refresh();
    } catch (e) {
      setErr(e.message);
    }
  }

  function exportar() {
    downloadCsv(
      `deudas_${localToday()}.csv`,
      ['Fecha', 'Acreedor', 'Concepto', 'Empresa', 'Valor', 'Abonado', 'Saldo', 'Fecha límite', 'Nota'],
      (pas?.rows || []).map((r) => [r.fecha, r.acreedor, r.concepto, r.empresa, r.monto, r.abonado, r.saldo, r.fecha_vencimiento, r.nota])
    );
  }

  const patri = bal?.patrimonio ?? 0;
  const neta = bal?.deuda.neta ?? 0;

  return (
    <div className="space-y-5">
      <PageHeader title="Balance" subtitle="Lo que tienes (activo), lo que debes (pasivo) y lo que te queda (patrimonio)." />

      <Panel>
        <Filtros value={filtro} onChange={setFiltro} empresas={empresas} />
        <p className="text-xs text-ink-soft mt-2">El periodo solo aplica a ingresos y egresos. Activo, pasivo y deudas muestran cómo están hoy.</p>
      </Panel>

      {err && <p className="text-alert text-sm">No se pudo cargar: {err}</p>}

      {!bal ? (
        <Skeleton className="h-56" />
      ) : (
        <>
          <div className="grid grid-cols-1 min-[440px]:grid-cols-2 lg:grid-cols-3 gap-3">
            <Tile label="Activo (lo que tengo)" value={cop(bal.activo.total)} sub={`Por cobrar ${cop(bal.activo.porCobrar)} + registrados ${cop(bal.activo.registrados)}`} tone="good" />
            <Tile label="Pasivo (lo que debo)" value={cop(bal.pasivo.total)} sub={bal.pasivo.n ? `Deudas ${cop(bal.pasivo.deudas)} + proveedores ${cop(bal.pasivo.proveedores)}${bal.pasivo.vencidas ? ` · ${bal.pasivo.vencidas} vencida${bal.pasivo.vencidas > 1 ? 's' : ''}` : ''}` : 'Sin deudas abiertas'} tone={bal.pasivo.total > 0 ? 'warn' : ''} />
            <Tile label="Patrimonio (activo − pasivo)" value={cop(patri)} tone={patri < 0 ? 'bad' : 'good'} big />
            <Tile label="Ingresos del periodo" value={cop(bal.periodo.ingresos)} sub={`${bal.periodo.nIngresos} registros`} tone="good" />
            <Tile label="Egresos del periodo" value={cop(bal.periodo.egresos)} sub={`Resultado: ${cop(bal.periodo.resultado)}`} />
            <Tile label="Deuda neta" value={cop(neta)} sub={neta >= 0 ? 'Te deben más de lo que debes' : 'Debes más de lo que te deben'} tone={neta < 0 ? 'bad' : 'good'} />
          </div>

          <div className="grid lg:grid-cols-2 gap-5">
            <Panel title="Deuda" subtitle="Lo que te deben frente a lo que debes.">
              <dl className="space-y-2 text-[15px]">
                <div className="flex justify-between"><dt className="text-ink-soft">Me deben (por cobrar)</dt><dd className="font-semibold text-ingreso">{cop(bal.deuda.meDeben)}</dd></div>
                <div className="flex justify-between"><dt className="text-ink-soft">Debo a personas</dt><dd className="font-semibold text-warn">{cop(bal.pasivo.deudas)}</dd></div>
                <div className="flex justify-between"><dt className="text-ink-soft">Debo a proveedores <Link to="/por-pagar" className="text-xs underline underline-offset-2 ml-1">ver</Link></dt><dd className="font-semibold text-warn">{cop(bal.pasivo.proveedores)}</dd></div>
                <div className="flex justify-between border-t border-line pt-2"><dt className="font-medium">Neta</dt><dd className={`font-display font-bold ${neta < 0 ? 'text-alert' : 'text-ingreso'}`}>{cop(neta)}</dd></div>
              </dl>
            </Panel>
            <Panel title="¿A quién le debo?" subtitle="Lo que falta por pagar, por persona.">
              {bal.pasivo.porAcreedor.length === 0 ? (
                <p className="text-sm text-ink-soft py-3">No debes nada por ahora.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {bal.pasivo.porAcreedor.map((a) => (
                    <li key={a.nombre} className="flex items-center justify-between gap-3 py-2">
                      <span>
                        <b>{a.nombre}</b>
                        <span className="text-xs text-ink-soft ml-2">{a.n} {a.n === 1 ? 'deuda' : 'deudas'}</span>
                      </span>
                      <span className="font-display font-bold whitespace-nowrap">{cop(a.v)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
        </>
      )}

      <Panel
        title="Pasivos: deudas con personas"
        subtitle="Préstamos y deudas con personas. Las facturas de proveedores están en Cuentas → Por pagar."
        action={
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-quiet !min-h-[44px] text-sm" onClick={exportar} disabled={!pas?.rows.length}><IconDownload /> Descargar</button>
            <button className="btn btn-primary !min-h-[44px] text-sm" onClick={() => setModal({ kind: 'pasivo' })}><IconPlus /> Nueva deuda</button>
          </div>
        }
      >
        <div className="flex gap-2 mb-3 text-sm">
          {[['abiertas', 'Abiertas'], ['pagadas', 'Pagadas'], ['todas', 'Todas']].map(([k, l]) => (
            <button key={k} type="button" onClick={() => setVerPag(k)} className={`px-3 min-h-[40px] rounded-full border ${verPag === k ? 'bg-ink text-white border-ink' : 'border-line text-ink-soft'}`}>{l}</button>
          ))}
        </div>
        {!pas ? (
          <Skeleton className="h-32" />
        ) : pas.rows.length === 0 ? (
          <p className="text-sm text-ink-soft py-6 text-center">{verPag === 'abiertas' ? 'No hay deudas abiertas.' : 'No hay deudas registradas.'}</p>
        ) : (
          <>
          <div className="rtable-wrap overflow-x-auto rounded-xl border border-line">
            <table className="rtable w-full text-[15px]">
              <thead className="bg-field text-left text-ink-soft">
                <tr>
                  <th className="px-3 py-2 font-medium">Fecha</th>
                  <th className="px-3 py-2 font-medium">Acreedor</th>
                  <th className="px-3 py-2 font-medium">Concepto</th>
                  <th className="px-3 py-2 font-medium text-right">Valor</th>
                  <th className="px-3 py-2 font-medium text-right">Abonado</th>
                  <th className="px-3 py-2 font-medium text-right">Saldo</th>
                  <th className="px-3 py-2 font-medium">Límite</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {pas.rows.map((r) => (
                  <Fragment key={r.id}>
                    <tr className="border-t border-line align-top">
                      <td data-label="Fecha" className="px-3 py-2 whitespace-nowrap">{shortDay(r.fecha)}</td>
                      <td data-label="Acreedor" className="px-3 py-2 font-medium">{r.acreedor}{r.empresa && <div className="mt-1"><EmpresaTag nombre={r.empresa} color={r.empresa_color} /></div>}</td>
                      <td data-label="Concepto" className="px-3 py-2">{r.concepto}{r.nota && <div className="text-xs text-ink-soft">{r.nota}</div>}</td>
                      <td data-label="Valor" className="px-3 py-2 text-right whitespace-nowrap">{cop(r.monto)}</td>
                      <td data-label="Abonado" className="px-3 py-2 text-right whitespace-nowrap">
                        {cop(r.abonado)}
                        {r.pagos.length > 0 && (
                          <button type="button" className="block ml-auto text-xs underline underline-offset-2 text-ink-soft" onClick={() => setAbiertos((o) => ({ ...o, [r.id]: !o[r.id] }))}>
                            {abiertos[r.id] ? 'Ocultar' : `Ver ${r.pagos.length} ${r.pagos.length === 1 ? 'abono' : 'abonos'}`}
                          </button>
                        )}
                      </td>
                      <td data-label="Saldo" className={`px-3 py-2 text-right whitespace-nowrap font-semibold ${r.saldo > 0 ? 'text-warn' : 'text-ingreso'}`}>{r.saldo > 0 ? cop(r.saldo) : 'Pagada ✓'}</td>
                      <td data-label="Límite" className="px-3 py-2 whitespace-nowrap">{r.fecha_vencimiento ? <span className={r.vencida ? 'text-alert font-medium' : ''}>{shortDay(r.fecha_vencimiento)}{r.vencida ? ' · vencida' : ''}</span> : '—'}</td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 justify-end">
                          {r.saldo > 0 && <button type="button" className="btn btn-primary !min-h-[40px] !px-3 text-sm" onClick={() => setModal({ kind: 'abono', row: r })}>Abonar</button>}
                          <button type="button" className="text-sm underline underline-offset-2 text-ink-soft min-h-[40px] px-1" onClick={() => setModal({ kind: 'pasivo', row: r })}>Editar</button>
                          <ConfirmDelete table="pasivos" id={r.id} onDeleted={() => { refresh(); }} />
                        </div>
                      </td>
                    </tr>
                    {abiertos[r.id] && (
                      <tr className="bg-field/60">
                        <td colSpan={8} className="px-3 py-2">
                          <ul className="text-sm space-y-1">
                            {r.pagos.map((g) => (
                              <li key={g.id} className="flex flex-wrap items-center justify-between gap-2">
                                <span>{shortDay(g.fecha)} · <b>{cop(g.monto)}</b>{g.nota ? ` · ${g.nota}` : ''}</span>
                                <button type="button" className="btn-link-danger" onClick={() => quitarAbono(r, g)}>Quitar</button>
                              </li>
                            ))}
                          </ul>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap justify-between gap-x-6 gap-y-1 rounded-xl bg-field px-4 py-3 mt-3 text-[15px] font-semibold">
            <span>Total ({pas.totales.n})</span>
            <span>Valor {cop(pas.totales.monto)}</span>
            <span>Abonado {cop(pas.totales.abonado)}</span>
            <span>Saldo {cop(pas.totales.saldo)}</span>
          </div>
          </>
        )}
      </Panel>

      <Panel
        title="Activos registrados"
        subtitle="Lo que tienes además de lo que te deben: bancos, inventario, vehículos, terrenos…"
        action={<button className="btn btn-primary !min-h-[44px] text-sm" onClick={() => setModal({ kind: 'activo' })}><IconPlus /> Nuevo activo</button>}
      >
        {!act ? (
          <Skeleton className="h-24" />
        ) : act.rows.length === 0 ? (
          <p className="text-sm text-ink-soft py-6 text-center">Todavía no hay activos registrados.</p>
        ) : (
          <>
          <div className="rtable-wrap overflow-x-auto rounded-xl border border-line">
            <table className="rtable w-full text-[15px]">
              <thead className="bg-field text-left text-ink-soft">
                <tr>
                  <th className="px-3 py-2 font-medium">Fecha</th>
                  <th className="px-3 py-2 font-medium">Tipo</th>
                  <th className="px-3 py-2 font-medium">Descripción</th>
                  <th className="px-3 py-2 font-medium">Empresa</th>
                  <th className="px-3 py-2 font-medium text-right">Valor</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {act.rows.map((r) => (
                  <tr key={r.id} className="border-t border-line align-top">
                    <td data-label="Fecha" className="px-3 py-2 whitespace-nowrap">{shortDay(r.fecha)}</td>
                    <td data-label="Tipo" className="px-3 py-2">{r.tipo}</td>
                    <td data-label="Descripción" className="px-3 py-2">{r.descripcion}{r.nota && <div className="text-xs text-ink-soft">{r.nota}</div>}</td>
                    <td data-label="Empresa" className="px-3 py-2">{r.empresa ? <EmpresaTag nombre={r.empresa} color={r.empresa_color} /> : <span className="text-ink-faint">General</span>}</td>
                    <td data-label="Valor" className="px-3 py-2 text-right whitespace-nowrap font-semibold">{cop(r.valor)}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-x-3 justify-end">
                        <button type="button" className="text-sm underline underline-offset-2 text-ink-soft min-h-[40px] px-1" onClick={() => setModal({ kind: 'activo', row: r })}>Editar</button>
                        <ConfirmDelete table="activos" id={r.id} onDeleted={() => { refresh(); }} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap justify-between gap-x-6 gap-y-1 rounded-xl bg-field px-4 py-3 mt-3 text-[15px] font-semibold">
            <span>Total ({act.totales.n})</span>
            <span>{cop(act.totales.valor)}</span>
          </div>
          </>
        )}
      </Panel>

      {modal?.kind === 'pasivo' && (
        <Modal title={modal.row ? 'Editar deuda' : 'Nueva deuda'} onClose={close} wide>
          <PasivoForm row={modal.row} onSaved={done} onCancel={close} />
        </Modal>
      )}
      {modal?.kind === 'abono' && (
        <Modal title="Registrar abono" onClose={close}>
          <AbonoForm row={modal.row} url={`/api/pasivos/${modal.row.id}/pago`} onSaved={done} onCancel={close} />
        </Modal>
      )}
      {modal?.kind === 'activo' && (
        <Modal title={modal.row ? 'Editar activo' : 'Nuevo activo'} onClose={close} wide>
          <ActivoForm row={modal.row} onSaved={done} onCancel={close} />
        </Modal>
      )}
    </div>
  );
}
