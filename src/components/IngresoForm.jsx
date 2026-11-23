import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { useApp } from '../App.jsx';
import { cop, num, shortDay, localToday, parseNum, MEDIOS_PAGO, MEDIOS_DIA, UNIDADES, MAX_DESPOSTES } from '../lib/format.js';
import { ErrorBox } from './ui.jsx';
import { Field, NumberInput, EmpresaPicker, Toggle2, useSugerencias, DataList, lastEmpresa } from './fields.jsx';

const toStr = (v) => (v == null ? '' : String(v).replace('.', ','));
const pos = (n) => (Number.isFinite(n) && n > 0 ? n : 0);
const nuevoDesposte = () => ({ valor: '', efectivo: '', venc: '', nota: '' });

// New income (row = null) or correction of an existing one.
// Companies marked "total del día" (Carnicería) get a simpler form: what came in as Efectivo and Nequi,
// plus up to 5 despostes (value, part paid in cash on the spot, the rest stays por cobrar).
// Everyone else keeps the full form.
export default function IngresoForm({ row, onSaved, onCancel }) {
  const { empresas } = useApp();
  const [f, setF] = useState(() =>
    row
      ? {
          ...row,
          cantidad: toStr(row.cantidad),
          precio_unitario: toStr(row.precio_unitario),
          unidad: row.unidad || '',
          medio_pago: row.medio_pago || '',
          nota: row.nota || '',
          fecha_vencimiento: row.fecha_vencimiento || '',
          fecha_pago: row.fecha_pago || '',
          monto: toStr(row.total),
          abono: row.abono_efectivo ? toStr(row.abono_efectivo) : '',
          medio_dia: MEDIOS_DIA.some((m) => m[0] === row.medio_pago) ? row.medio_pago : row.estado === 'pendiente' ? 'desposte' : 'efectivo',
        }
      : {
          empresa_id: lastEmpresa.get('ing') || empresas[0]?.id,
          fecha: localToday(),
          cliente: '',
          concepto: '',
          cantidad: '1',
          unidad: '',
          precio_unitario: '',
          medio_pago: 'efectivo',
          estado: 'pagado',
          fecha_vencimiento: '',
          fecha_pago: '',
          nota: '',
          m_efectivo: '',
          m_nequi: '',
          despostes: [nuevoDesposte()],
        }
  );
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [ya, setYa] = useState(0); // despostes already saved for that company and day
  const sug = useSugerencias(f.empresa_id);
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v && v.target ? v.target.value : v }));

  const empresa = empresas.find((e) => e.id === Number(f.empresa_id));
  const diario = !!empresa?.ingreso_diario;
  const cobra = !!empresa?.cobra_pendientes;

  // how many despostes that day already exist (the limit is 5 per day)
  useEffect(() => {
    if (!diario || !f.fecha) return;
    let vivo = true;
    api
      .get(`/api/ingresos?empresa=${f.empresa_id}&desde=${f.fecha}&hasta=${f.fecha}&limit=200`)
      .then((r) => vivo && setYa(r.rows.filter((x) => x.medio_pago === 'desposte' && x.id !== row?.id).length))
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [diario, f.empresa_id, f.fecha, row?.id]);
  const cupo = Math.max(0, MAX_DESPOSTES - ya); // despostes still allowed that day

  // ---- full form values
  const cant = parseNum(f.cantidad);
  const precio = parseNum(f.precio_unitario);
  const total = cant > 0 && precio >= 0 ? Math.round(cant * precio) : null;
  const okCompleto = f.empresa_id && f.fecha && f.cliente.trim() && f.concepto.trim() && cant > 0 && precio >= 0;

  // ---- total-del-día values
  const nuevoDia = !row;
  const mE = pos(parseNum(f.m_efectivo));
  const mN = pos(parseNum(f.m_nequi));
  const desp = (f.despostes || []).map((d) => {
    const valor = parseNum(d.valor);
    const ef = d.efectivo === '' ? 0 : parseNum(d.efectivo);
    const vacio = d.valor === '' && d.efectivo === '';
    const valido = pos(valor) > 0 && Number.isFinite(ef) && ef >= 0 && ef <= valor;
    return { ...d, valorN: pos(valor), efN: Number.isFinite(ef) ? Math.max(0, ef) : 0, vacio, valido };
  });
  const despUsados = desp.filter((d) => !d.vacio);
  const despMalos = despUsados.some((d) => !d.valido);
  const sumDesp = despUsados.reduce((s, d) => s + (d.valido ? d.valorN : 0), 0);
  const sumDespEf = despUsados.reduce((s, d) => s + (d.valido ? d.efN : 0), 0);
  const totalDia = mE + mN + sumDesp;
  const enCaja = mE + sumDespEf;
  const quedaPorCobrar = sumDesp - sumDespEf;

  const montoUno = parseNum(f.monto);
  const abonoUno = f.abono === '' ? 0 : parseNum(f.abono);
  const enDesposte = !nuevoDia && f.medio_dia === 'desposte';
  const desposteCobrado = !!row && row.medio_pago === 'desposte' && row.estado === 'pagado' && f.medio_dia === 'desposte';
  const abonoMalo = enDesposte && (!Number.isFinite(abonoUno) || abonoUno < 0 || abonoUno > montoUno);
  const okDia = f.empresa_id && f.fecha && (nuevoDia ? totalDia > 0 && !despMalos && despUsados.length <= cupo : montoUno > 0 && !abonoMalo && (!enDesposte || ya + 1 <= MAX_DESPOSTES));

  const setDesp = (i, k) => (v) =>
    setF((x) => ({ ...x, despostes: x.despostes.map((d, j) => (j === i ? { ...d, [k]: v && v.target ? v.target.value : v } : d)) }));
  const quitarDesp = (i) => setF((x) => ({ ...x, despostes: x.despostes.filter((_, j) => j !== i) }));
  const agregarDesp = () => setF((x) => ({ ...x, despostes: [...x.despostes, nuevoDesposte()] }));

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      if (diario && nuevoDia) {
        await api.post('/api/ingresos', {
          empresa_id: f.empresa_id,
          fecha: f.fecha,
          montos: { efectivo: mE || '', nequi: mN || '' },
          despostes: despUsados.map((d) => ({ valor: d.valorN, efectivo: d.efN, fecha_vencimiento: d.venc, nota: d.nota })),
        });
      } else if (diario) {
        await api.put(`/api/ingresos/${row.id}`, {
          empresa_id: f.empresa_id,
          fecha: f.fecha,
          monto: montoUno,
          medio_pago: f.medio_dia,
          abono_efectivo: enDesposte ? abonoUno : 0,
          estado: f.medio_dia === 'desposte' && !desposteCobrado ? 'pendiente' : 'pagado',
          fecha_pago: f.fecha_pago,
          fecha_vencimiento: f.fecha_vencimiento,
          nota: f.nota,
        });
      } else {
        const { despostes, m_efectivo, m_nequi, monto, abono, medio_dia, ...rest } = f; // eslint-disable-line no-unused-vars
        const body = { ...rest, cantidad: cant, precio_unitario: precio, estado: cobra ? f.estado : 'pagado' };
        if (row) await api.put(`/api/ingresos/${row.id}`, body);
        else await api.post('/api/ingresos', body);
      }
      lastEmpresa.set('ing', f.empresa_id);
      window.dispatchEvent(new Event('ingresos:changed'));
      onSaved();
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setBusy(false);
    }
  }

  const ok = diario ? okDia : okCompleto;
  const submitLabel = busy ? 'Guardando…' : row ? 'Guardar cambios' : diario ? 'Guardar ingresos del día' : 'Guardar ingreso';

  return (
    <form onSubmit={save} className="space-y-4">
      <Field label="Empresa">
        <EmpresaPicker empresas={empresas} value={f.empresa_id} onChange={set('empresa_id')} />
      </Field>

      {diario ? (
        <>
          <Field label="Fecha" htmlFor="i-fecha" className="sm:max-w-[260px]">
            <input id="i-fecha" type="date" className="field" value={f.fecha} onChange={set('fecha')} max="2100-12-31" />
          </Field>

          {nuevoDia ? (
            <>
              <p className="text-sm text-ink-soft -mb-1">Escribe cuánto entró en el día. Deja en blanco lo que no hubo.</p>
              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Efectivo" htmlFor="i-efectivo">
                  <NumberInput id="i-efectivo" money value={f.m_efectivo} onChange={set('m_efectivo')} placeholder="0" />
                </Field>
                <Field label="Nequi" htmlFor="i-nequi">
                  <NumberInput id="i-nequi" money value={f.m_nequi} onChange={set('m_nequi')} placeholder="0" />
                </Field>
              </div>

              <div className="rounded-xl border border-[#E8C984] bg-warn-bg/40 p-4 space-y-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h4 className="font-display font-semibold text-warn">Despostes del día</h4>
                  <span className="text-xs text-ink-soft">
                    Máximo {MAX_DESPOSTES} por día{ya > 0 ? ` · ese día ya hay ${ya}, puedes agregar ${cupo}` : ''}
                  </span>
                </div>
                <p className="text-sm text-ink-soft">
                  Escribe el valor de cada desposte y cuánto pagaron en efectivo. Lo que falte queda por cobrar.
                </p>
                {f.despostes.map((d, i) => {
                  const x = desp[i];
                  const resta = x.valorN - x.efN;
                  return (
                    <div key={i} className="rounded-xl bg-white border border-line p-3.5 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold">Desposte {i + 1}</span>
                        {f.despostes.length > 1 && (
                          <button type="button" className="btn-link-danger" onClick={() => quitarDesp(i)}>Quitar</button>
                        )}
                      </div>
                      <div className="grid sm:grid-cols-2 gap-3">
                        <Field label="Valor del desposte" htmlFor={`d-valor-${i}`}>
                          <NumberInput id={`d-valor-${i}`} money value={d.valor} onChange={setDesp(i, 'valor')} placeholder="0" />
                        </Field>
                        <Field label="Pagado en efectivo (opcional)" htmlFor={`d-ef-${i}`}>
                          <NumberInput id={`d-ef-${i}`} money value={d.efectivo} onChange={setDesp(i, 'efectivo')} placeholder="0" />
                        </Field>
                      </div>
                      {!x.vacio && !x.valido && (
                        <p className="text-sm text-alert" role="alert">
                          {x.valorN <= 0 ? 'Escribe el valor del desposte.' : 'El efectivo no puede ser mayor que el valor del desposte.'}
                        </p>
                      )}
                      {x.valido && (
                        <p className={`text-sm font-medium ${resta > 0 ? 'text-warn' : 'text-farm-green'}`}>
                          {resta > 0 ? `Queda por cobrar: ${cop(resta)}` : 'Pagado completo en efectivo'}
                        </p>
                      )}
                      <div className="grid sm:grid-cols-2 gap-3">
                        <Field label="¿Cuándo se espera el pago? (opcional)" htmlFor={`d-venc-${i}`}>
                          <input id={`d-venc-${i}`} type="date" className="field" value={d.venc} min={f.fecha} onChange={setDesp(i, 'venc')} />
                        </Field>
                        <Field label="Detalle (opcional)" htmlFor={`d-nota-${i}`}>
                          <input id={`d-nota-${i}`} className="field" value={d.nota} onChange={setDesp(i, 'nota')} placeholder="Ej: para Don Pedro" />
                        </Field>
                      </div>
                    </div>
                  );
                })}
                <button
                  type="button"
                  className="btn btn-quiet !min-h-[44px] text-sm"
                  onClick={agregarDesp}
                  disabled={f.despostes.length >= cupo}
                >
                  + Agregar otro desposte
                </button>
                {cupo === 0 && <p className="text-sm text-alert">Ese día ya tiene {MAX_DESPOSTES} despostes.</p>}
                {despUsados.length > cupo && cupo > 0 && <p className="text-sm text-alert">Solo puedes agregar {cupo} {cupo === 1 ? 'desposte' : 'despostes'} ese día.</p>}
              </div>

              <div className="rounded-xl bg-field px-4 py-3 grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className="text-xs text-ink-soft">Total del día</div>
                  <div className="font-display font-bold text-lg text-ingreso">{totalDia > 0 ? cop(totalDia) : '—'}</div>
                </div>
                <div>
                  <div className="text-xs text-ink-soft">Entró en efectivo</div>
                  <div className="font-semibold">{enCaja > 0 ? cop(enCaja) : '—'}</div>
                </div>
                <div>
                  <div className="text-xs text-ink-soft">Queda por cobrar</div>
                  <div className={`font-semibold ${quedaPorCobrar > 0 ? 'text-warn' : ''}`}>{quedaPorCobrar > 0 ? cop(quedaPorCobrar) : '—'}</div>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="grid sm:grid-cols-2 gap-4">
                <Field label={enDesposte ? 'Valor del desposte' : 'Valor'} htmlFor="i-monto">
                  <NumberInput id="i-monto" money value={f.monto} onChange={set('monto')} placeholder="0" />
                </Field>
                <Field label="Forma de pago" htmlFor="i-medio-dia">
                  <select id="i-medio-dia" className="field" value={f.medio_dia} onChange={set('medio_dia')}>
                    <option value="efectivo">Efectivo</option>
                    <option value="nequi">Nequi</option>
                    <option value="desposte">Desposte (por cobrar)</option>
                  </select>
                </Field>
              </div>

              {enDesposte && (
                <div className="rounded-xl border border-[#E8C984] bg-warn-bg/50 p-4 space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <Field label="Pagado en efectivo (opcional)" htmlFor="i-abono">
                      <NumberInput id="i-abono" money value={f.abono} onChange={set('abono')} placeholder="0" />
                    </Field>
                    <div className="self-end pb-3 text-sm font-medium">
                      {abonoMalo ? (
                        <span className="text-alert">El efectivo no puede ser mayor que el valor.</span>
                      ) : montoUno > 0 ? (
                        <span className={montoUno - abonoUno > 0 ? 'text-warn' : 'text-farm-green'}>
                          {montoUno - abonoUno > 0 ? `Queda por cobrar: ${cop(montoUno - abonoUno)}` : 'Pagado completo en efectivo'}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <p className="text-sm text-warn font-medium">
                    {desposteCobrado
                      ? `Este desposte ya fue cobrado${row?.fecha_pago ? ' (el ' + shortDay(row.fecha_pago) + ')' : ''}.`
                      : 'Lo que falte queda en “Por cobrar” hasta que lo marques como pagado.'}
                  </p>
                  <div className="grid sm:grid-cols-2 gap-4">
                    {!desposteCobrado && (
                      <Field label="¿Cuándo se espera el pago? (opcional)" htmlFor="i-venc">
                        <input id="i-venc" type="date" className="field" value={f.fecha_vencimiento} min={f.fecha} onChange={set('fecha_vencimiento')} />
                      </Field>
                    )}
                    <Field label="Detalle (opcional)" htmlFor="i-nota">
                      <input id="i-nota" className="field" value={f.nota} onChange={set('nota')} placeholder="Ej: para Don Pedro" />
                    </Field>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      ) : (
        <>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Fecha" htmlFor="i-fecha">
              <input id="i-fecha" type="date" className="field" value={f.fecha} onChange={set('fecha')} max="2100-12-31" />
            </Field>
            <Field label="Cliente o de quién viene" htmlFor="i-cliente">
              <input id="i-cliente" className="field" list="dl-clientes" value={f.cliente} onChange={set('cliente')} placeholder="Ej: Frigorífico Guadalupe" />
              <DataList id="dl-clientes" items={sug.clientes} />
            </Field>
          </div>

          <Field label="Concepto / origen del ingreso" htmlFor="i-concepto" hint="Qué se vendió o de dónde salió el dinero.">
            <input id="i-concepto" className="field" list="dl-conc-ing" value={f.concepto} onChange={set('concepto')} placeholder="Ej: Venta de carne de res, flete, venta de palmiste, venta de frutas y verduras" />
            <DataList id="dl-conc-ing" items={sug.conceptosIng} />
          </Field>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <Field label="Cantidad" htmlFor="i-cant">
              <NumberInput id="i-cant" value={f.cantidad} onChange={set('cantidad')} />
            </Field>
            <Field label="Unidad" htmlFor="i-unidad">
              <input id="i-unidad" className="field" list="dl-unidades" value={f.unidad} onChange={set('unidad')} placeholder="kg, viaje…" />
              <DataList id="dl-unidades" items={[...sug.unidades, ...UNIDADES]} />
            </Field>
            <Field label="Precio por unidad" htmlFor="i-precio" className="col-span-2 sm:col-span-1">
              <NumberInput id="i-precio" money value={f.precio_unitario} onChange={set('precio_unitario')} placeholder="0" />
            </Field>
          </div>

          <div className="rounded-xl bg-field px-4 py-3 flex items-center justify-between gap-3">
            <span className="text-ink-soft">
              Total{cant > 0 && precio >= 0 ? ` (${num(cant)} × ${cop(precio)})` : ''}
            </span>
            <span className="font-display font-bold text-xl text-ingreso">{total == null ? '—' : cop(total)}</span>
          </div>

          {cobra && (
            <Field label="¿Ya se recibió el pago?">
              <Toggle2
                label="Estado del pago"
                value={f.estado}
                onChange={set('estado')}
                a={{ value: 'pagado', label: '✓ Pagado' }}
                b={{ value: 'pendiente', label: '◷ Pendiente por cobrar', tone: 'warn' }}
              />
            </Field>
          )}

          <div className="grid sm:grid-cols-2 gap-4">
            {cobra && f.estado === 'pendiente' ? (
              <Field label="Fecha límite de pago (opcional)" htmlFor="i-venc">
                <input id="i-venc" type="date" className="field" value={f.fecha_vencimiento} min={f.fecha} onChange={set('fecha_vencimiento')} />
              </Field>
            ) : (
              <Field label="Medio de pago" htmlFor="i-medio">
                <select id="i-medio" className="field" value={f.medio_pago} onChange={set('medio_pago')}>
                  <option value="">—</option>
                  {MEDIOS_PAGO.map(([k, l]) => (
                    <option key={k} value={k}>{l}</option>
                  ))}
                </select>
              </Field>
            )}
            <Field label="Nota (opcional)" htmlFor="i-nota">
              <input id="i-nota" className="field" value={f.nota} onChange={set('nota')} placeholder="Ej: factura 123" />
            </Field>
          </div>
        </>
      )}

      <ErrorBox>{err}</ErrorBox>

      <div className="grid grid-cols-2 gap-3 pt-1">
        <button type="button" className="btn btn-quiet" onClick={onCancel} disabled={busy}>Cancelar</button>
        <button className="btn btn-primary" disabled={busy || !ok}>{submitLabel}</button>
      </div>
    </form>
  );
}
