import { useState } from 'react';
import { api } from '../lib/api.js';
import { useApp } from '../App.jsx';
import { cop, num, localToday, parseNum, ivaSplit, MEDIOS_PAGO, UNIDADES, IVA_TARIFAS, CATEGORIAS_GASTO } from '../lib/format.js';
import { ErrorBox } from './ui.jsx';
import { Field, NumberInput, EmpresaPicker, Toggle2, useSugerencias, DataList, lastEmpresa } from './fields.jsx';

const toStr = (v) => (v == null ? '' : String(v).replace('.', ','));

// New expense (row = null) or correction of an existing one.
export default function GastoForm({ row, onSaved, onCancel }) {
  const { empresas } = useApp();
  const [f, setF] = useState(() =>
    row
      ? {
          ...row,
          cantidad: toStr(row.cantidad),
          precio_unitario: toStr(row.precio_unitario),
          precio_incluye_iva: !!row.precio_incluye_iva,
          nit: row.nit || '',
          factura: row.factura || '',
          unidad: row.unidad || '',
          medio_pago: row.medio_pago || '',
          nota: row.nota || '',
        }
      : {
          empresa_id: lastEmpresa.get('gas') || empresas[0]?.id,
          fecha: localToday(),
          proveedor: '',
          nit: '',
          factura: '',
          categoria: '',
          concepto: '',
          cantidad: '1',
          unidad: '',
          precio_unitario: '',
          precio_incluye_iva: true,
          iva_tarifa: 19,
          medio_pago: 'efectivo',
          nota: '',
        }
  );
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const sug = useSugerencias(f.empresa_id);
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v && v.target ? v.target.value : v }));

  function setProveedor(e) {
    const v = e.target.value;
    const known = sug.proveedores.find((p) => p.v === v);
    setF((x) => ({ ...x, proveedor: v, nit: known && known.nit && !x.nit ? known.nit : x.nit }));
  }

  const cant = parseNum(f.cantidad);
  const precio = parseNum(f.precio_unitario);
  const tarifa = Number(f.iva_tarifa);
  const calc = cant > 0 && precio >= 0 ? ivaSplit(cant, precio, f.precio_incluye_iva, tarifa) : null;
  const ok = f.empresa_id && f.fecha && f.proveedor.trim() && f.categoria.trim() && f.concepto.trim() && cant > 0 && precio >= 0;

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      const body = { ...f, cantidad: cant, precio_unitario: precio, iva_tarifa: tarifa };
      if (row) await api.put(`/api/gastos/${row.id}`, body);
      else await api.post('/api/gastos', body);
      lastEmpresa.set('gas', f.empresa_id);
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
        <Field label="Fecha" htmlFor="g-fecha">
          <input id="g-fecha" type="date" className="field" value={f.fecha} onChange={set('fecha')} />
        </Field>
        <Field label="Categoría" htmlFor="g-cat">
          <input id="g-cat" className="field" list="dl-cat" value={f.categoria} onChange={set('categoria')} placeholder="Ej: Combustible" />
          <DataList id="dl-cat" items={[...sug.categorias, ...CATEGORIAS_GASTO]} />
        </Field>
      </div>

      <div className="grid sm:grid-cols-[1.4fr_1fr_1fr] gap-4">
        <Field label="Proveedor" htmlFor="g-prov">
          <input id="g-prov" className="field" list="dl-prov" value={f.proveedor} onChange={setProveedor} placeholder="Ej: Estación Terpel" />
          <DataList id="dl-prov" items={sug.proveedores.map((p) => p.v)} />
        </Field>
        <Field label="NIT / cédula (opcional)" htmlFor="g-nit">
          <input id="g-nit" className="field" value={f.nit} onChange={set('nit')} placeholder="900.123.456-7" />
        </Field>
        <Field label="Nº factura (opcional)" htmlFor="g-fac">
          <input id="g-fac" className="field" value={f.factura} onChange={set('factura')} placeholder="FE-1234" />
        </Field>
      </div>

      <Field label="Concepto" htmlFor="g-conc" hint="Qué se compró o se pagó.">
        <input id="g-conc" className="field" list="dl-conc-gas" value={f.concepto} onChange={set('concepto')} placeholder="Ej: ACPM para el camión" />
        <DataList id="dl-conc-gas" items={sug.conceptosGas} />
      </Field>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <Field label="Cantidad" htmlFor="g-cant">
          <NumberInput id="g-cant" value={f.cantidad} onChange={set('cantidad')} />
        </Field>
        <Field label="Unidad" htmlFor="g-unidad">
          <input id="g-unidad" className="field" list="dl-unidades-g" value={f.unidad} onChange={set('unidad')} placeholder="galón, bulto…" />
          <DataList id="dl-unidades-g" items={[...sug.unidades, ...UNIDADES]} />
        </Field>
        <Field label="Precio por unidad" htmlFor="g-precio" className="col-span-2 sm:col-span-1">
          <NumberInput id="g-precio" money value={f.precio_unitario} onChange={set('precio_unitario')} placeholder="0" />
        </Field>
      </div>

      <div className="grid sm:grid-cols-[1.4fr_1fr] gap-4">
        <Field label="El precio que escribiste…">
          <Toggle2
            label="IVA en el precio"
            value={f.precio_incluye_iva}
            onChange={set('precio_incluye_iva')}
            a={{ value: true, label: 'Ya incluye IVA' }}
            b={{ value: false, label: 'Sin IVA (se le suma)', tone: 'warn' }}
          />
        </Field>
        <Field label="Tarifa de IVA" htmlFor="g-iva">
          <select id="g-iva" className="field" value={f.iva_tarifa} onChange={(e) => set('iva_tarifa')(Number(e.target.value))}>
            {IVA_TARIFAS.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </Field>
      </div>

      <div className="rounded-xl bg-field px-4 py-3 grid grid-cols-3 gap-2 text-center">
        <div>
          <div className="text-xs text-ink-soft">Base (sin IVA)</div>
          <div className="font-semibold">{calc ? cop(calc.base) : '—'}</div>
        </div>
        <div>
          <div className="text-xs text-ink-soft">IVA {num(tarifa)} %</div>
          <div className="font-semibold">{calc ? cop(calc.iva) : '—'}</div>
        </div>
        <div>
          <div className="text-xs text-ink-soft">Total pagado</div>
          <div className="font-display font-bold text-lg text-gasto">{calc ? cop(calc.total) : '—'}</div>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Medio de pago" htmlFor="g-medio">
          <select id="g-medio" className="field" value={f.medio_pago} onChange={set('medio_pago')}>
            <option value="">—</option>
            {MEDIOS_PAGO.map(([k, l]) => (
              <option key={k} value={k}>{l}</option>
            ))}
          </select>
        </Field>
        <Field label="Nota (opcional)" htmlFor="g-nota">
          <input id="g-nota" className="field" value={f.nota} onChange={set('nota')} />
        </Field>
      </div>

      <ErrorBox>{err}</ErrorBox>

      <div className="grid grid-cols-2 gap-3 pt-1">
        <button type="button" className="btn btn-quiet" onClick={onCancel} disabled={busy}>Cancelar</button>
        <button className="btn btn-primary" disabled={busy || !ok}>{busy ? 'Guardando…' : row ? 'Guardar cambios' : 'Guardar gasto'}</button>
      </div>
    </form>
  );
}
