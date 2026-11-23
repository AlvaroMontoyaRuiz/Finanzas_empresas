import { useState } from 'react';
import { api } from '../lib/api.js';
import { cop, localToday, parseNum } from '../lib/format.js';
import { ErrorBox } from './ui.jsx';
import { Field, NumberInput } from './fields.jsx';

// Pay part (or all) of a debt or supplier bill. `url` is the endpoint that receives { fecha, monto, nota }.
export default function AbonoForm({ row, url, onSaved, onCancel }) {
  const [fecha, setFecha] = useState(localToday());
  const [monto, setMonto] = useState('');
  const [nota, setNota] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const n = parseNum(monto);
  const ok = n > 0 && n <= row.saldo;

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      await api.post(url, { fecha, monto: n, nota });
      window.dispatchEvent(new Event('balance:changed'));
      onSaved();
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <p className="text-ink-soft">
        <b className="text-ink">{row.acreedor}</b> · {row.factura ? `Factura ${row.factura}` : row.concepto}
      </p>
      <div className="grid grid-cols-3 gap-2 rounded-xl bg-field px-4 py-3 text-center">
        <div><div className="text-xs text-ink-soft">Valor</div><div className="font-semibold">{cop(row.monto)}</div></div>
        <div><div className="text-xs text-ink-soft">Abonado</div><div className="font-semibold">{cop(row.abonado)}</div></div>
        <div><div className="text-xs text-ink-soft">Falta</div><div className="font-display font-bold text-warn">{cop(row.saldo)}</div></div>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Valor del abono" htmlFor="a-monto">
          <NumberInput id="a-monto" money value={monto} onChange={(e) => setMonto(e && e.target ? e.target.value : e)} placeholder="0" />
        </Field>
        <Field label="Fecha del abono" htmlFor="a-fecha">
          <input id="a-fecha" type="date" className="field" value={fecha} min={row.fecha} onChange={(e) => setFecha(e.target.value)} />
        </Field>
      </div>
      <button type="button" className="text-sm font-medium text-farm-green underline underline-offset-2" onClick={() => setMonto(String(row.saldo))}>
        Pagar todo lo que falta ({cop(row.saldo)})
      </button>
      {n > 0 && n <= row.saldo && (
        <p className="text-sm font-medium">{n === row.saldo ? 'Con este abono queda pagada.' : `Después de este abono quedarán ${cop(row.saldo - n)}.`}</p>
      )}
      {n > row.saldo && <p className="text-sm text-alert">El abono no puede ser mayor que lo que falta ({cop(row.saldo)}).</p>}
      <Field label="Nota (opcional)" htmlFor="a-nota">
        <input id="a-nota" className="field" value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Ej: efectivo, transferencia Nequi" />
      </Field>
      <ErrorBox>{err}</ErrorBox>
      <div className="grid grid-cols-2 gap-3">
        <button type="button" className="btn btn-quiet" onClick={onCancel} disabled={busy}>Cancelar</button>
        <button className="btn btn-primary" disabled={busy || !ok}>{busy ? 'Guardando…' : 'Registrar abono'}</button>
      </div>
    </form>
  );
}
