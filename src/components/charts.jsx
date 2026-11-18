// Charts for the Panel.
import { useState } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { cop, copShort, monthShort, monthLong, num, COLOR_INGRESO, COLOR_GASTO } from '../lib/format.js';
import { LegendDot, Segmented } from './ui.jsx';

function MesTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-white rounded-xl border border-line shadow-panel px-3.5 py-2.5 text-sm min-w-[200px]">
      <div className="font-semibold mb-1">{monthLong(label)}</div>
      <Row color={COLOR_INGRESO} label="Ingresos" v={cop(d.ingresos)} />
      <Row color={COLOR_GASTO} label="Gastos" v={cop(d.gastos)} />
      <div className="border-t border-line mt-1.5 pt-1.5 flex justify-between gap-4">
        <span className="text-ink-soft">Utilidad</span>
        <b className={d.utilidad < 0 ? 'text-alert' : ''}>{cop(d.utilidad)}</b>
      </div>
    </div>
  );
}
const Row = ({ color, label, v }) => (
  <div className="flex justify-between gap-4">
    <span className="inline-flex items-center gap-1.5 text-ink-soft">
      <span className="w-2.5 h-2.5 rounded-sm" style={{ background: color }} aria-hidden />
      {label}
    </span>
    <b>{v}</b>
  </div>
);

// Income vs expenses per month (grouped bars) with a table view for accessibility.
export function IngresosGastosMes({ data }) {
  const [vista, setVista] = useState('grafica');
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div className="flex gap-4">
          <LegendDot color={COLOR_INGRESO}>Ingresos</LegendDot>
          <LegendDot color={COLOR_GASTO}>Gastos</LegendDot>
        </div>
        <Segmented
          label="Vista"
          value={vista}
          onChange={setVista}
          options={[
            { value: 'grafica', label: 'Gráfica' },
            { value: 'tabla', label: 'Tabla' },
          ]}
        />
      </div>
      {vista === 'grafica' ? (
        <div className="h-[280px] -ml-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} barGap={2} barCategoryGap="22%" margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
              <CartesianGrid vertical={false} stroke="#EDF0E9" />
              <XAxis dataKey="mes" tickFormatter={monthShort} tickLine={false} axisLine={{ stroke: '#E2E7DC' }} tick={{ fill: '#5B6B60', fontSize: 12 }} interval="preserveStartEnd" minTickGap={8} />
              <YAxis tickFormatter={copShort} tickLine={false} axisLine={false} tick={{ fill: '#5B6B60', fontSize: 12 }} width={78} />
              <Tooltip content={<MesTooltip />} cursor={{ fill: 'rgba(23,38,29,0.05)' }} />
              <Bar dataKey="ingresos" name="Ingresos" fill={COLOR_INGRESO} radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
              <Bar dataKey="gastos" name="Gastos" fill={COLOR_GASTO} radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="rtable-wrap overflow-x-auto rounded-xl border border-line">
          <table className="rtable w-full text-[15px]">
            <thead className="bg-field text-left text-ink-soft">
              <tr>
                <th className="px-3 py-2 font-medium">Mes</th>
                <th className="px-3 py-2 font-medium text-right">Ingresos</th>
                <th className="px-3 py-2 font-medium text-right">Gastos</th>
                <th className="px-3 py-2 font-medium text-right">Utilidad</th>
                <th className="px-3 py-2 font-medium text-right">IVA pagado</th>
              </tr>
            </thead>
            <tbody>
              {data.map((r) => (
                <tr key={r.mes} className="border-t border-line">
                  <td data-label="Mes" className="px-3 py-2">{monthLong(r.mes)}</td>
                  <td data-label="Ingresos" className="px-3 py-2 text-right">{cop(r.ingresos)}</td>
                  <td data-label="Gastos" className="px-3 py-2 text-right">{cop(r.gastos)}</td>
                  <td data-label="Utilidad" className={`px-3 py-2 text-right font-semibold ${r.utilidad < 0 ? 'text-alert' : ''}`}>{cop(r.utilidad)}</td>
                  <td data-label="IVA pagado" className="px-3 py-2 text-right">{cop(r.iva)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// Horizontal bars as plain HTML: label, bar, value. items = [{ nombre, v, sub? }]
export function BarList({ items, color, empty = 'Sin datos en este periodo.', max: maxIn, top = 8 }) {
  if (!items.length) return <p className="text-sm text-ink-soft py-6 text-center">{empty}</p>;
  let list = items;
  if (items.length > top) {
    const rest = items.slice(top - 1);
    list = [...items.slice(0, top - 1), { nombre: `Otras (${rest.length})`, v: rest.reduce((s, r) => s + r.v, 0), otras: true }];
  }
  const max = maxIn || Math.max(...list.map((r) => r.v), 1);
  const total = items.reduce((s, r) => s + r.v, 0);
  return (
    <ul className="space-y-2.5">
      {list.map((r) => (
        <li key={r.nombre} className="group" title={`${r.nombre}: ${cop(r.v)} (${num((r.v / (total || 1)) * 100)} %)`}>
          <div className="flex items-baseline justify-between gap-3 text-[15px]">
            <span className={`truncate ${r.otras ? 'text-ink-soft' : ''}`}>{r.nombre}</span>
            <span className="font-semibold whitespace-nowrap">
              {cop(r.v)} <span className="text-xs font-normal text-ink-faint">{num(Math.round((r.v / (total || 1)) * 100))} %</span>
            </span>
          </div>
          {r.sub && <div className="text-xs text-ink-soft">{r.sub}</div>}
          <div className="h-2 mt-1 rounded-full bg-[#EDF0E9] overflow-hidden">
            <div
              className="h-full rounded-full transition-[width] duration-500 group-hover:brightness-110"
              style={{ width: `${Math.max(1.5, (r.v / max) * 100)}%`, background: r.otras ? '#8A978E' : color }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

// Each company: income and expense bars on a shared scale + profit.
export function PorEmpresa({ rows, onPick, selected }) {
  const max = Math.max(...rows.flatMap((r) => [r.ingresos, r.gastos]), 1);
  return (
    <div>
      <div className="flex gap-4 mb-3">
        <LegendDot color={COLOR_INGRESO}>Ingresos</LegendDot>
        <LegendDot color={COLOR_GASTO}>Gastos</LegendDot>
      </div>
      <ul className="divide-y divide-line">
        {rows.map((r) => {
          const margen = r.ingresos > 0 ? (r.utilidad / r.ingresos) * 100 : null;
          return (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => onPick(selected === r.id ? 0 : r.id)}
                aria-pressed={selected === r.id}
                className={`w-full text-left py-3 px-2 -mx-2 rounded-xl grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1.5 hover:bg-field ${selected === r.id ? 'bg-field' : ''}`}
              >
                <span className="font-semibold inline-flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full" style={{ background: r.color }} aria-hidden />
                  {r.nombre}
                </span>
                <span className="text-right">
                  <span className={`font-display font-bold ${r.utilidad < 0 ? 'text-alert' : ''}`}>{cop(r.utilidad)}</span>
                  {margen != null && <span className="text-xs text-ink-soft ml-1.5">{num(Math.round(margen))} %</span>}
                </span>
                <div className="col-span-2 space-y-1">
                  <MiniBar v={r.ingresos} max={max} color={COLOR_INGRESO} label={`Ingresos ${cop(r.ingresos)}`} />
                  <MiniBar v={r.gastos} max={max} color={COLOR_GASTO} label={`Gastos ${cop(r.gastos)}`} />
                </div>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-ink-faint mt-2">Utilidad = ingresos − gastos (con IVA). El % es el margen sobre los ingresos. Toca una empresa para filtrar el panel.</p>
    </div>
  );
}

function MiniBar({ v, max, color, label }) {
  return (
    <div className="flex items-center gap-2" title={label}>
      <div className="flex-1 h-2.5 rounded-full bg-[#EDF0E9] overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${v > 0 ? Math.max(1, (v / max) * 100) : 0}%`, background: color }} />
      </div>
      <span className="text-xs text-ink-soft w-[92px] text-right whitespace-nowrap">{copShort(v)}</span>
    </div>
  );
}
