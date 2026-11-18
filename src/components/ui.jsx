// Small shared UI pieces.
import { useEffect } from 'react';
import { PERIODOS, periodo } from '../lib/format.js';

export function Panel({ title, subtitle, action, children, className = '', pad = true }) {
  return (
    <section className={`bg-white rounded-2xl border border-line shadow-panel ${className}`}>
      {(title || action) && (
        <header className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2 px-5 pt-4 pb-1">
          <div>
            {title && <h2 className="font-display font-semibold text-[17px] leading-tight text-ink">{title}</h2>}
            {subtitle && <p className="text-sm text-ink-soft mt-0.5">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      <div className={pad ? 'px-5 pb-5 pt-3' : 'pt-3'}>{children}</div>
    </section>
  );
}

export function PageHeader({ title, subtitle, action }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display font-bold text-[28px] sm:text-[30px] leading-tight">{title}</h1>
        {subtitle && <p className="text-ink-soft">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Segmented({ value, onChange, options, label, large = false }) {
  return (
    <div role="group" aria-label={label} className="inline-flex bg-field rounded-full p-0.5 text-sm">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={`${large ? 'px-5 min-h-[44px]' : 'px-3 py-1.5'} rounded-full font-medium whitespace-nowrap transition-colors ${
            value === o.value ? 'bg-white text-ink shadow-sm' : 'text-ink-soft hover:text-ink'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function LegendDot({ color, children }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-ink-soft">
      <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: color }} aria-hidden />
      {children}
    </span>
  );
}

export function Skeleton({ className = '' }) {
  return <div className={`skeleton ${className}`} aria-hidden />;
}

export function ErrorBox({ children }) {
  if (!children) return null;
  return (
    <p role="alert" className="rounded-xl bg-alert-bg text-alert text-sm px-3.5 py-2.5">
      {children}
    </p>
  );
}

export function EmpresaTag({ nombre, color }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <span className="inline-block w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} aria-hidden />
      {nombre}
    </span>
  );
}

export function EstadoBadge({ estado, vencido }) {
  if (estado === 'pendiente') {
    return (
      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${vencido ? 'bg-alert-bg text-alert' : 'bg-warn-bg text-warn'}`}>
        <span aria-hidden>{vencido ? '!' : '◷'}</span> {vencido ? 'Vencido' : 'Pendiente'}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold bg-[#E3EFE8] text-farm-green">
      <span aria-hidden>✓</span> Pagado
    </span>
  );
}

// Bottom sheet on phones, centered dialog on bigger screens.
export function Modal({ title, onClose, children, wide = false }) {
  useEffect(() => {
    const k = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', k);
      document.body.style.overflow = '';
    };
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 bg-ink/50 flex items-end sm:items-center justify-center sm:p-4" onClick={onClose} role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`bg-white w-full ${wide ? 'sm:max-w-2xl' : 'sm:max-w-md'} max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-2xl p-5 sm:p-6 shadow-panel text-left`}
        style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <h3 className="font-display font-bold text-xl">{title}</h3>
          <button type="button" onClick={onClose} className="w-10 h-10 -mr-2 -mt-1 rounded-full hover:bg-field text-ink-soft text-xl" aria-label="Cerrar">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// Period + company filter row shared by Panel, Ingresos and Gastos.
// value = { periodo, desde, hasta, empresa }
export function Filtros({ value, onChange, empresas, children, hideEmpresa = false }) {
  const set = (patch) => onChange({ ...value, ...patch });
  return (
    <div className="flex flex-wrap items-end gap-3">
      <label className="block min-w-[170px]">
        <span className="label">Periodo</span>
        <select
          className="field"
          value={value.periodo}
          onChange={(e) => {
            const p = e.target.value;
            set(p === 'otro' ? { periodo: p } : { periodo: p, ...periodo(p) });
          }}
        >
          {PERIODOS.map(([k, l]) => (
            <option key={k} value={k}>{l}</option>
          ))}
        </select>
      </label>
      {value.periodo === 'otro' && (
        <>
          <label className="block">
            <span className="label">Desde</span>
            <input type="date" className="field" value={value.desde} onChange={(e) => set({ desde: e.target.value })} />
          </label>
          <label className="block">
            <span className="label">Hasta</span>
            <input type="date" className="field" value={value.hasta} onChange={(e) => set({ hasta: e.target.value })} />
          </label>
        </>
      )}
      {!hideEmpresa && (
        <label className="block min-w-[170px]">
          <span className="label">Empresa</span>
          <select className="field" value={value.empresa} onChange={(e) => set({ empresa: Number(e.target.value) })}>
            <option value={0}>Todas las empresas</option>
            {empresas.map((e) => (
              <option key={e.id} value={e.id}>{e.nombre}</option>
            ))}
          </select>
        </label>
      )}
      {children}
    </div>
  );
}

export const initialFiltro = (p = 'mes') => ({ periodo: p, ...periodo(p), empresa: 0 });

/* ---------- icons (inline, currentColor) ---------- */
const base = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };
export const IconPlus = (p) => (<svg {...base} {...p}><path d="M12 5v14M5 12h14" /></svg>);
export const IconDownload = (p) => (<svg {...base} {...p}><path d="M12 4v11M7 10l5 5 5-5M5 20h14" /></svg>);
export const IconUp = (p) => (<svg {...base} {...p}><path d="M7 14l5-5 5 5" /></svg>);
export const IconDown = (p) => (<svg {...base} {...p}><path d="M7 10l5 5 5-5" /></svg>);
export const IconAlert = (p) => (<svg {...base} {...p}><path d="M12 4l9 16H3L12 4z" /><path d="M12 10v4M12 17.5v.01" /></svg>);
