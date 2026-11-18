// Form building blocks shared by the income and expense forms.
import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { cop, parseNum } from '../lib/format.js';

export function Field({ label, htmlFor, hint, children, className = '' }) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="label">{label}</label>
      {children}
      {hint && <p className="text-xs text-ink-faint mt-1">{hint}</p>}
    </div>
  );
}

// Text input for money / quantities. Accepts "1.250.000", "1250000" or "12,5".
export function NumberInput({ id, value, onChange, placeholder, money = false }) {
  const n = parseNum(value);
  return (
    <div>
      <div className="relative">
        {money && <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint">$</span>}
        <input
          id={id}
          className={`field ${money ? 'pl-7' : ''}`}
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete="off"
        />
      </div>
      {money && value !== '' && (
        <p className={`text-xs mt-1 ${Number.isFinite(n) ? 'text-ink-soft' : 'text-alert'}`}>{Number.isFinite(n) ? cop(n) : 'Número no válido'}</p>
      )}
    </div>
  );
}

// Big colored buttons to choose the company (one tap on a phone).
export function EmpresaPicker({ empresas, value, onChange }) {
  return (
    <div role="radiogroup" aria-label="Empresa" className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      {empresas.map((e) => {
        const on = Number(value) === e.id;
        return (
          <button
            key={e.id}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(e.id)}
            className={`min-h-[48px] rounded-xl border-2 px-3 font-semibold flex items-center gap-2 transition-colors ${
              on ? 'text-white' : 'bg-white text-ink border-line hover:border-ink-faint'
            }`}
            style={on ? { background: e.color, borderColor: e.color } : undefined}
          >
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: on ? '#fff' : e.color }} aria-hidden />
            {e.nombre}
          </button>
        );
      })}
    </div>
  );
}

export function Toggle2({ value, onChange, a, b, label }) {
  // a/b = { value, label, tone }
  return (
    <div role="radiogroup" aria-label={label} className="grid grid-cols-2 gap-2">
      {[a, b].map((o) => {
        const on = value === o.value;
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={`min-h-[48px] rounded-xl border-2 px-3 font-semibold text-[15px] leading-tight transition-colors ${
              on ? (o.tone === 'warn' ? 'bg-warn-bg border-[#C77A0A] text-warn' : 'bg-[#E3EFE8] border-farm-green text-farm-green') : 'bg-white border-line text-ink-soft hover:border-ink-faint'
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// Autocomplete values from earlier records
export function useSugerencias(empresa) {
  const [s, setS] = useState({ clientes: [], conceptosIng: [], proveedores: [], categorias: [], conceptosGas: [], unidades: [] });
  useEffect(() => {
    api.get('/api/sugerencias' + (empresa ? `?empresa=${empresa}` : '')).then(setS).catch(() => {});
  }, [empresa]);
  return s;
}

export function DataList({ id, items }) {
  return (
    <datalist id={id}>
      {[...new Set(items)].map((v) => (
        <option key={v} value={v} />
      ))}
    </datalist>
  );
}

export const lastEmpresa = {
  get(key) {
    try { return Number(localStorage.getItem('emp:' + key)) || 0; } catch { return 0; }
  },
  set(key, v) {
    try { localStorage.setItem('emp:' + key, String(v)); } catch { /* ignore */ }
  },
};
