import { useEffect, useState } from 'react';
import { api, qs } from '../lib/api.js';
import { cop, shortDay, whenLabel } from '../lib/format.js';
import { Panel, PageHeader, Skeleton } from '../components/ui.jsx';

const TABLES = { ingresos: 'Ingreso', gastos: 'Gasto' };

export default function Eliminados() {
  const [rows, setRows] = useState(null);
  const [table, setTable] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => {
    api.get('/api/eliminados' + qs({ table, desde, hasta })).then((r) => setRows(r.rows)).catch((e) => setErr(e.message));
  }, [table, desde, hasta]);

  return (
    <div className="space-y-5">
      <PageHeader title="Historial de eliminados" subtitle="Cada registro que se elimina queda guardado aquí, con quién lo hizo y por qué." />
      <Panel>
        <div className="grid sm:grid-cols-3 gap-3 mb-4">
          <label className="block">
            <span className="label">Tipo de registro</span>
            <select value={table} onChange={(e) => setTable(e.target.value)} className="field">
              <option value="">Todos</option>
              <option value="ingresos">Ingresos</option>
              <option value="gastos">Gastos</option>
            </select>
          </label>
          <label className="block">
            <span className="label">Eliminado desde</span>
            <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="field" />
          </label>
          <label className="block">
            <span className="label">Hasta</span>
            <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className="field" />
          </label>
        </div>
        {err && <p className="text-alert text-sm">No se pudo cargar: {err}</p>}
        {!rows && !err ? (
          <Skeleton className="h-40" />
        ) : rows && rows.length === 0 ? (
          <p className="text-sm text-ink-soft py-6 text-center">No hay registros eliminados.</p>
        ) : rows ? (
          <div className="rtable-wrap overflow-x-auto rounded-xl border border-line">
            <table className="rtable w-full text-[15px]">
              <thead className="bg-field text-left text-ink-soft">
                <tr>
                  <th className="px-3 py-2 font-medium">Cuándo</th>
                  <th className="px-3 py-2 font-medium">Tipo</th>
                  <th className="px-3 py-2 font-medium">Registro</th>
                  <th className="px-3 py-2 font-medium text-right">Valor</th>
                  <th className="px-3 py-2 font-medium">Eliminó</th>
                  <th className="px-3 py-2 font-medium">Motivo</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const p = r.payload || {};
                  return (
                    <tr key={r.id} className="border-t border-line align-top">
                      <td data-label="Cuándo" className="px-3 py-2 whitespace-nowrap">{whenLabel(r.deleted_at)}</td>
                      <td data-label="Tipo" className="px-3 py-2">{TABLES[r.table_name] || r.table_name}</td>
                      <td data-label="Registro" className="px-3 py-2">
                        <b>{p.cliente || p.proveedor}</b> · {p.concepto}
                        <div className="text-xs text-ink-soft">del {shortDay(p.fecha)}</div>
                      </td>
                      <td data-label="Valor" className="px-3 py-2 text-right whitespace-nowrap">{cop(p.total)}</td>
                      <td data-label="Eliminó" className="px-3 py-2 text-ink-soft">{r.eliminado_por || '—'}</td>
                      <td data-label="Motivo" className="px-3 py-2">{r.reason || <span className="text-ink-faint">Sin motivo</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </Panel>
    </div>
  );
}
