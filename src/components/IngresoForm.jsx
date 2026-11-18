import { useState } from 'react';
import { api } from '../lib/api.js';
import { useApp } from '../App.jsx';
import { cop, num, localToday, parseNum, MEDIOS_PAGO, UNIDADES } from '../lib/format.js';
import { ErrorBox } from './ui.jsx';
import { Field, NumberInput, EmpresaPicker, Toggle2, useSugerencias, DataList, lastEmpresa } from './fields.jsx';

const toStr = (v) => (v == null ? '' : String(v).replace('.', ','));

// New income (row = null) or correction of an existing one.
export default function IngresoForm({ row, onSaved, onCancel }) {
  const { empresas } = useApp();
  const [f, setF] = useState(() =>
    row
      ? { ...row, cantidad: toStr(row.cantidad), precio_unitario: toStr(row.precio_unitario), unidad: row.unidad || '', medio_pago: row.medio_pago || '', nota: row.nota || '', fecha_vencimiento: row.fecha_vencimiento || '', fecha_pago: row.fecha_pago || '' }
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
        }
  );
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const sug = useSugerencias(f.empresa_id);
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v && v.target ? v.target.value : v }));

  const empresa = empresas.find((e) => e.id === Number(f.empresa_id));
  const cobra = !!empresa?.cobra_pendientes;
  const cant = parseNum(f.cantidad);
  const precio = parseNum(f.precio_unitario);
  const total = cant > 0 && precio >= 0 ? Math.round(cant * precio) : null;
  const ok = f.empresa_id && f.fecha && f.cliente.trim() && f.concepto.trim() && cant > 0 && precio >= 0;

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      const body = { ...f, cantidad: cant, precio_unitario: precio, estado: cobra ? f.estado : 'pagado' };
      if (row) await api.put(`/api/ingresos/${row.id}`, body);
      else await api.post('/api/ingresos', body);
      lastEmpresa.set('ing', f.empresa_id);
      window.dispatchEvent(new Event('ingresos:changed'));
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
        <Field label="Fecha" htmlFor="i-fecha">
          <input id="i-fecha" type="date" className="field" value={f.fecha} onChange={set('fecha')} max="2100-12-31" />
        </Field>
        <Field label="Cliente o de quién viene" htmlFor="i-cliente">
          <input id="i-cliente" className="field" list="dl-clientes" value={f.cliente} onChange={set('cliente')} placeholder="Ej: Frigorífico Guadalupe" />
          <DataList id="dl-clientes" items={sug.clientes} />
        </Field>
      </div>

      <Field label="Concepto / origen del ingreso" htmlFor="i-concepto" hint="Qué se vendió o de dónde salió el dinero.">
        <input id="i-concepto" className="field" list="dl-conc-ing" value={f.concepto} onChange={set('concepto')} placeholder="Ej: Venta de carne de res, flete, venta de palmiste" />
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

      <ErrorBox>{err}</ErrorBox>

      <div className="grid grid-cols-2 gap-3 pt-1">
        <button type="button" className="btn btn-quiet" onClick={onCancel} disabled={busy}>Cancelar</button>
        <button className="btn btn-primary" disabled={busy || !ok}>{busy ? 'Guardando…' : row ? 'Guardar cambios' : 'Guardar ingreso'}</button>
      </div>
    </form>
  );
}
