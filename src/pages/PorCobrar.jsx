import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, qs } from '../lib/api.js';
import { useApp } from '../App.jsx';
import { cop, num, shortDay, daysSince, localToday } from '../lib/format.js';
import { Panel, PageHeader, Skeleton, EmpresaTag, EstadoBadge, Segmented } from '../components/ui.jsx';
import PagoButton from '../components/Pago.jsx';

// Who owes what. For Carnicería these are the despostes: each one stays here until it is marked as paid.
// Rows without a client (daily totals) are identified by their concept ("Desposte") and note.
const quien = (r) => r.cliente || r.concepto;
const saldo = (r) => r.total - (r.abono_efectivo || 0); // what is still owed: the value minus the cash already received
const detalle = (r) =>
  [
    r.cliente ? r.concepto : null,
    r.cliente ? `${num(r.cantidad)} ${r.unidad || ''}`.trim() : null,
    r.abono_efectivo > 0 ? `valor ${cop(r.total)}, efectivo recibido ${cop(r.abono_efectivo)}` : null,
    r.nota,
    shortDay(r.fecha),
  ]
    .filter(Boolean)
    .join(' · ');

export default function PorCobrar() {
  const { empresas } = useApp();
  const conPendientes = empresas.filter((e) => e.cobra_pendientes);
  const [empresa, setEmpresa] = useState(0);
  const [vista, setVista] = useState('pendientes'); // 'pendientes' | 'pagados'
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState('');

  const load = useCallback(() => {
    setErr('');
    const pend = vista === 'pendientes';
    api
      .get('/api/ingresos' + qs(pend ? { estado: 'pendiente', empresa } : { cobrados: 1, empresa, limit: 300 }))
      .then((r) =>
        setRows(
          pend
            ? [...r.rows].sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : a.id - b.id))
            : [...r.rows].sort((a, b) => ((b.fecha_pago || '') < (a.fecha_pago || '') ? -1 : 1))
        )
      )
      .catch((e) => setErr(e.message));
  }, [empresa, vista]);
  useEffect(() => {
    setRows(null);
    load();
  }, [load]);

  const pendientes = vista === 'pendientes';
  const hoy = localToday();
  const resumen = useMemo(() => {
    if (!rows) return null;
    const porQuien = {};
    for (const r of rows) {
      const c = (porQuien[quien(r)] ||= { nombre: quien(r), n: 0, total: 0, desde: r.fecha });
      c.n++;
      c.total += pendientes ? saldo(r) : r.total;
      if (r.fecha < c.desde) c.desde = r.fecha;
    }
    const vencidas = rows.filter((r) => r.fecha_vencimiento && r.fecha_vencimiento < hoy);
    return {
      total: rows.reduce((s, r) => s + (pendientes ? saldo(r) : r.total), 0),
      vencidas: vencidas.length,
      totalVencido: vencidas.reduce((s, r) => s + saldo(r), 0),
      grupos: Object.values(porQuien).sort((a, b) => b.total - a.total),
    };
  }, [rows, hoy, pendientes]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Por cobrar"
        subtitle="Los despostes y ventas que todavía no se han pagado. Cuando te paguen, toca “Marcar pagado”."
        action={
          <div className="flex flex-wrap items-center gap-3">
            <Segmented
              label="Ver"
              value={vista}
              onChange={setVista}
              large
              options={[
                { value: 'pendientes', label: 'Pendientes' },
                { value: 'pagados', label: 'Ya pagados' },
              ]}
            />
            {conPendientes.length > 1 && (
              <select className="field !w-auto" value={empresa} onChange={(e) => setEmpresa(Number(e.target.value))} aria-label="Empresa">
                <option value={0}>Todas</option>
                {conPendientes.map((e) => (
                  <option key={e.id} value={e.id}>{e.nombre}</option>
                ))}
              </select>
            )}
          </div>
        }
      />

      {err && <p className="text-alert text-sm">No se pudo cargar: {err}</p>}
      {!rows && !err && <Skeleton className="h-40" />}

      {resumen && pendientes && (
        <div className="grid sm:grid-cols-3 gap-4">
          <Tile label="Total por cobrar" value={cop(resumen.total)} tone="text-warn" />
          <Tile label="Pendientes" value={num(rows.length)} sub={`${num(resumen.grupos.length)} ${resumen.grupos.length === 1 ? 'origen' : 'orígenes'}`} />
          <Tile
            label="Con fecha vencida"
            value={num(resumen.vencidas)}
            sub={resumen.vencidas ? cop(resumen.totalVencido) : 'Ninguno pasó la fecha esperada'}
            tone={resumen.vencidas ? 'text-alert' : ''}
          />
        </div>
      )}

      {rows && rows.length === 0 && (
        <Panel>
          <p className="text-center py-8 text-ink-soft">
            <span className="block text-3xl mb-2" aria-hidden>{pendientes ? '✓' : '·'}</span>
            {pendientes ? 'No hay nada pendiente. Todo está cobrado.' : 'Todavía no hay despostes ni ventas cobradas.'}
          </p>
        </Panel>
      )}

      {rows && rows.length > 0 && pendientes && (
        <div className="grid lg:grid-cols-[1fr_2fr] gap-5 items-start">
          <Panel title="Resumen" subtitle="Cuánto hay pendiente por cada origen">
            <ul className="divide-y divide-line">
              {resumen.grupos.map((c) => (
                <li key={c.nombre} className="py-2.5 flex items-center justify-between gap-3">
                  <div>
                    <div className="font-medium">{c.nombre}</div>
                    <div className="text-xs text-ink-soft">
                      {c.n} {c.n === 1 ? 'pendiente' : 'pendientes'} · desde {shortDay(c.desde)}
                    </div>
                  </div>
                  <div className="font-semibold whitespace-nowrap">{cop(c.total)}</div>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="Pendientes de pago" subtitle="El más antiguo primero">
            <ul className="divide-y divide-line -mt-1">
              {rows.map((r) => {
                const dias = daysSince(r.fecha);
                const vencido = r.fecha_vencimiento && r.fecha_vencimiento < hoy;
                return (
                  <li key={r.id} className="py-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                    <div className="flex-1 min-w-[200px]">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold">{quien(r)}</span>
                        <EstadoBadge estado="pendiente" vencido={vencido} />
                      </div>
                      <div className="text-sm text-ink-soft">
                        {detalle(r)}{' '}
                        <span className={dias > 30 ? 'text-alert font-medium' : ''}>
                          ({dias === 0 ? 'hoy' : dias === 1 ? 'hace 1 día' : `hace ${dias} días`})
                        </span>
                        {r.fecha_vencimiento && <> · {r.cliente ? 'límite' : 'se espera el pago el'} {shortDay(r.fecha_vencimiento)}</>}
                      </div>
                      {conPendientes.length > 1 && <div className="text-xs mt-0.5"><EmpresaTag nombre={r.empresa} color={r.empresa_color} /></div>}
                    </div>
                    <div className="text-right whitespace-nowrap">
                      <div className="font-display font-bold text-lg">{cop(saldo(r))}</div>
                      {r.abono_efectivo > 0 && <div className="text-xs text-ink-soft">de {cop(r.total)}</div>}
                    </div>
                    <PagoButton row={r} onDone={load} />
                  </li>
                );
              })}
            </ul>
          </Panel>
        </div>
      )}

      {rows && rows.length > 0 && !pendientes && (
        <Panel
          title="Ya pagados"
          subtitle={`${num(rows.length)} ${rows.length === 1 ? 'cobrado' : 'cobrados'} · ${cop(resumen.total)} (los más recientes primero)`}
        >
          <ul className="divide-y divide-line -mt-1">
            {rows.map((r) => (
              <li key={r.id} className="py-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                <div className="flex-1 min-w-[200px]">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold">{quien(r)}</span>
                    <EstadoBadge estado="pagado" />
                  </div>
                  <div className="text-sm text-ink-soft">
                    {detalle(r)}
                    {r.fecha_pago && <> · pagado el {shortDay(r.fecha_pago)}</>}
                  </div>
                  {conPendientes.length > 1 && <div className="text-xs mt-0.5"><EmpresaTag nombre={r.empresa} color={r.empresa_color} /></div>}
                </div>
                <div className="font-display font-bold text-lg whitespace-nowrap">{cop(r.total)}</div>
                <PagoButton row={r} onDone={load} />
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}

function Tile({ label, value, sub, tone = '' }) {
  return (
    <div className="bg-white rounded-2xl border border-line shadow-panel px-5 py-4">
      <div className="text-sm text-ink-soft">{label}</div>
      <div className={`font-display font-bold text-[26px] leading-tight mt-1 ${tone}`}>{value}</div>
      {sub && <div className="text-sm text-ink-soft mt-0.5">{sub}</div>}
    </div>
  );
}
