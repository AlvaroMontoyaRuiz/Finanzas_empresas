import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, qs } from '../lib/api.js';
import { useApp } from '../App.jsx';
import { cop, num, shortDay, daysSince, localToday } from '../lib/format.js';
import { Panel, PageHeader, Skeleton, EmpresaTag, EstadoBadge } from '../components/ui.jsx';
import PagoButton from '../components/Pago.jsx';

// Sales still waiting to be paid (Carnicería, or any company with that option on).
export default function PorCobrar() {
  const { empresas } = useApp();
  const conPendientes = empresas.filter((e) => e.cobra_pendientes);
  const [empresa, setEmpresa] = useState(0);
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState('');

  const load = useCallback(() => {
    api
      .get('/api/ingresos' + qs({ estado: 'pendiente', empresa }))
      .then((r) => setRows([...r.rows].sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : a.id - b.id))))
      .catch((e) => setErr(e.message));
  }, [empresa]);
  useEffect(load, [load]);

  const hoy = localToday();
  const resumen = useMemo(() => {
    if (!rows) return null;
    const porCliente = {};
    for (const r of rows) {
      const c = (porCliente[r.cliente] ||= { cliente: r.cliente, n: 0, total: 0, desde: r.fecha });
      c.n++;
      c.total += r.total;
      if (r.fecha < c.desde) c.desde = r.fecha;
    }
    const vencidas = rows.filter((r) => r.fecha_vencimiento && r.fecha_vencimiento < hoy);
    return {
      total: rows.reduce((s, r) => s + r.total, 0),
      vencidas: vencidas.length,
      totalVencido: vencidas.reduce((s, r) => s + r.total, 0),
      clientes: Object.values(porCliente).sort((a, b) => b.total - a.total),
    };
  }, [rows, hoy]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Por cobrar"
        subtitle="Ventas que todavía no se han pagado. Cuando el cliente pague, toca “Marcar pagado”."
        action={
          conPendientes.length > 1 && (
            <select className="field !w-auto" value={empresa} onChange={(e) => setEmpresa(Number(e.target.value))} aria-label="Empresa">
              <option value={0}>Todas</option>
              {conPendientes.map((e) => (
                <option key={e.id} value={e.id}>{e.nombre}</option>
              ))}
            </select>
          )
        }
      />

      {err && <p className="text-alert text-sm">No se pudo cargar: {err}</p>}
      {!rows && !err && <Skeleton className="h-40" />}

      {resumen && (
        <div className="grid sm:grid-cols-3 gap-4">
          <Tile label="Total por cobrar" value={cop(resumen.total)} tone="text-warn" />
          <Tile label="Ventas pendientes" value={num(rows.length)} sub={`${num(resumen.clientes.length)} ${resumen.clientes.length === 1 ? 'cliente' : 'clientes'}`} />
          <Tile
            label="Vencidas"
            value={num(resumen.vencidas)}
            sub={resumen.vencidas ? cop(resumen.totalVencido) : 'Ninguna pasó su fecha límite'}
            tone={resumen.vencidas ? 'text-alert' : ''}
          />
        </div>
      )}

      {rows && rows.length === 0 && (
        <Panel>
          <p className="text-center py-8 text-ink-soft">
            <span className="block text-3xl mb-2" aria-hidden>✓</span>
            No hay ventas pendientes. Todo está cobrado.
          </p>
        </Panel>
      )}

      {rows && rows.length > 0 && (
        <div className="grid lg:grid-cols-[1fr_2fr] gap-5 items-start">
          <Panel title="Por cliente" subtitle="Quién debe y cuánto">
            <ul className="divide-y divide-line">
              {resumen.clientes.map((c) => (
                <li key={c.cliente} className="py-2.5 flex items-center justify-between gap-3">
                  <div>
                    <div className="font-medium">{c.cliente}</div>
                    <div className="text-xs text-ink-soft">
                      {c.n} {c.n === 1 ? 'venta' : 'ventas'} · desde {shortDay(c.desde)}
                    </div>
                  </div>
                  <div className="font-semibold whitespace-nowrap">{cop(c.total)}</div>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="Ventas pendientes" subtitle="La más antigua primero">
            <ul className="divide-y divide-line -mt-1">
              {rows.map((r) => {
                const dias = daysSince(r.fecha);
                const vencido = r.fecha_vencimiento && r.fecha_vencimiento < hoy;
                return (
                  <li key={r.id} className="py-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                    <div className="flex-1 min-w-[200px]">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold">{r.cliente}</span>
                        <EstadoBadge estado="pendiente" vencido={vencido} />
                      </div>
                      <div className="text-sm text-ink-soft">
                        {r.concepto} · {num(r.cantidad)} {r.unidad || ''} · {shortDay(r.fecha)}{' '}
                        <span className={dias > 30 ? 'text-alert font-medium' : ''}>
                          ({dias === 0 ? 'hoy' : dias === 1 ? 'hace 1 día' : `hace ${dias} días`})
                        </span>
                        {r.fecha_vencimiento && <> · límite {shortDay(r.fecha_vencimiento)}</>}
                      </div>
                      {conPendientes.length > 1 && <div className="text-xs mt-0.5"><EmpresaTag nombre={r.empresa} color={r.empresa_color} /></div>}
                    </div>
                    <div className="font-display font-bold text-lg whitespace-nowrap">{cop(r.total)}</div>
                    <PagoButton row={r} onDone={load} />
                  </li>
                );
              })}
            </ul>
          </Panel>
        </div>
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
