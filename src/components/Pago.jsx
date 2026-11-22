import { useState } from 'react';
import { api } from '../lib/api.js';
import { cop, localToday, MEDIOS_PAGO, shortDay } from '../lib/format.js';
import { Modal, ErrorBox } from './ui.jsx';

// "Marcar pagado" button + small dialog (date and how it was paid). For a paid sale of a
// company that manages pending sales, "Volver a pendiente" undoes a mistake.
export default function PagoButton({ row, onDone, cobra = true }) {
  const [open, setOpen] = useState(false);
  const [fecha, setFecha] = useState(localToday());
  const [medio, setMedio] = useState(row.medio_pago || 'efectivo');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function go(pagado) {
    setBusy(true);
    setErr('');
    try {
      await api.post(`/api/ingresos/${row.id}/pago`, { pagado, fecha_pago: fecha, medio_pago: medio });
      setOpen(false);
      window.dispatchEvent(new Event('ingresos:changed'));
      onDone && onDone();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (row.estado === 'pagado') {
    if (!cobra) return null;
    return (
      <button type="button" className="text-sm text-ink-soft underline underline-offset-2 px-2 min-h-[40px]" onClick={() => go(false)} disabled={busy}>
        Volver a pendiente
      </button>
    );
  }

  return (
    <>
      <button type="button" className="btn btn-primary !min-h-[40px] !px-3 text-sm" onClick={() => setOpen(true)}>
        Marcar pagado
      </button>
      {open && (
        <Modal title="Registrar el pago" onClose={() => !busy && setOpen(false)}>
          <p className="text-ink-soft">
            <b className="text-ink">{row.cliente || row.concepto}</b>{row.cliente ? ` · ${row.concepto}` : row.nota ? ` · ${row.nota}` : ''} · del {shortDay(row.fecha)}
          </p>
          <p className="font-display font-bold text-2xl mt-2">{cop(row.total - (row.abono_efectivo || 0))}</p>
          {row.abono_efectivo > 0 && (
            <p className="text-sm text-ink-soft">
              Valor del desposte {cop(row.total)} · ya recibido en efectivo {cop(row.abono_efectivo)}
            </p>
          )}
          <div className={`grid ${row.medio_pago === 'desposte' ? 'grid-cols-1' : 'grid-cols-2'} gap-3 mt-4`}>
            <label className="block">
              <span className="label">Fecha del pago</span>
              <input type="date" className="field" value={fecha} min={row.fecha} onChange={(e) => setFecha(e.target.value)} />
            </label>
            {row.medio_pago !== 'desposte' && (
              <label className="block">
                <span className="label">Medio de pago</span>
                <select className="field" value={medio} onChange={(e) => setMedio(e.target.value)}>
                  {MEDIOS_PAGO.map(([k, l]) => (
                    <option key={k} value={k}>{l}</option>
                  ))}
                </select>
              </label>
            )}
          </div>
          <div className="mt-3"><ErrorBox>{err}</ErrorBox></div>
          <div className="grid grid-cols-2 gap-3 mt-5">
            <button className="btn btn-quiet" onClick={() => setOpen(false)} disabled={busy}>Cancelar</button>
            <button className="btn btn-primary" onClick={() => go(true)} disabled={busy || !fecha}>{busy ? 'Guardando…' : 'Confirmar pago'}</button>
          </div>
        </Modal>
      )}
    </>
  );
}
