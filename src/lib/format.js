// Formatting helpers. Everything user-facing is Spanish (Colombia).

const nf = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 });
export const num = (n) => nf.format(Number(n || 0));

// Money: Colombian pesos, no cents
const nfCop = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
export const cop = (n) => (n == null ? '—' : nfCop.format(Math.round(Number(n))).replace(/ /g, ' '));

// Short money for chart axes: $ 1,2 M · $ 350 mil
export function copShort(n) {
  const v = Number(n || 0);
  const a = Math.abs(v);
  const s = v < 0 ? '−' : '';
  if (a >= 1e9) return `${s}$ ${nf.format(Math.round(a / 1e8) / 10)} mil M`;
  if (a >= 1e6) return `${s}$ ${nf.format(Math.round(a / 1e5) / 10)} M`;
  if (a >= 1e3) return `${s}$ ${nf.format(Math.round(a / 1e3))} mil`;
  return `${s}$ ${nf.format(Math.round(a))}`;
}

export const pct = (n) => `${nf.format(Math.round(n * 10) / 10)} %`;

export const COLOR_INGRESO = '#1F7A4D';
export const COLOR_GASTO = '#C77A0A';

export const IVA_TARIFAS = [
  { value: 0, label: '0 % (exento / excluido)' },
  { value: 5, label: '5 %' },
  { value: 19, label: '19 % (general)' },
];

export const MEDIOS_PAGO = [
  ['efectivo', 'Efectivo'],
  ['transferencia', 'Transferencia'],
  ['nequi', 'Nequi'],
  ['daviplata', 'Daviplata'],
  ['tarjeta', 'Tarjeta'],
  ['cheque', 'Cheque'],
  ['credito', 'Crédito'],
  ['otro', 'Otro'],
];
// Companies that only record the total of the day (Carnicería): how the money came in.
export const MEDIOS_DIA = [
  ['efectivo', 'Efectivo'],
  ['nequi', 'Nequi'],
  ['desposte', 'Desposte'],
];
export const medioLabel = (m) => ([...MEDIOS_PAGO, ...MEDIOS_DIA].find((x) => x[0] === m) || [null, ''])[1];

// Types of assets entered by hand in the Balance
export const TIPOS_ACTIVO = ['Caja y bancos', 'Inventario', 'Maquinaria y equipo', 'Vehículos', 'Terrenos y construcciones', 'Animales', 'Cultivos', 'Otros'];
export const MAX_DESPOSTES = 5;

export const UNIDADES = ['unidad', 'kg', 'libra', 'arroba', 'tonelada', 'litro', 'galón', 'bulto', 'viaje', 'cabeza', 'hora', 'día', 'mes', 'servicio'];

export const CATEGORIAS_GASTO = [
  'Alimento / concentrado', 'Combustible', 'Peajes', 'Mantenimiento y repuestos', 'Nómina y jornales',
  'Seguridad social', 'Servicios públicos', 'Arriendo', 'Compra de mercancía', 'Insumos agrícolas',
  'Medicamentos veterinarios', 'Transporte / fletes', 'Impuestos y trámites', 'Seguros', 'Papelería y oficina', 'Otros',
];

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const dayDate = (s) => new Date(s + 'T12:00:00');

export const longDay = (s) => cap(dayDate(s).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }));
export const shortDay = (s) => (s ? dayDate(s).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' }).replace(/\./g, '') : '—');
export const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export const monthShort = (ym) => cap(MESES[Number(ym.slice(5, 7)) - 1].slice(0, 3)) + ' ' + ym.slice(2, 4);
export const monthLong = (ym) => cap(MESES[Number(ym.slice(5, 7)) - 1]) + ' ' + ym.slice(0, 4);

// Today as the browser sees it 'YYYY-MM-DD'
export function localToday() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}
export function addDays(s, n) {
  const d = new Date(s + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export const daysSince = (s) => Math.round((dayDate(localToday()) - dayDate(s)) / 86400000);

// The API stores timestamps as UTC 'YYYY-MM-DD HH:MM:SS'
export function whenLabel(ts) {
  if (!ts) return '';
  const d = new Date(String(ts).replace(' ', 'T') + 'Z');
  return d.toLocaleString('es-CO', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }).replace(/\./g, '');
}

// Period presets for filters
export function periodo(key) {
  const hoy = localToday();
  const y = Number(hoy.slice(0, 4));
  const m = Number(hoy.slice(5, 7));
  const pad = (n) => String(n).padStart(2, '0');
  const lastDay = (yy, mm) => new Date(Date.UTC(yy, mm, 0)).getUTCDate();
  switch (key) {
    case 'mes':
      return { desde: `${y}-${pad(m)}-01`, hasta: hoy };
    case 'mes_anterior': {
      const yy = m === 1 ? y - 1 : y;
      const mm = m === 1 ? 12 : m - 1;
      return { desde: `${yy}-${pad(mm)}-01`, hasta: `${yy}-${pad(mm)}-${lastDay(yy, mm)}` };
    }
    case 'trimestre': {
      const q = Math.floor((m - 1) / 3) * 3 + 1;
      return { desde: `${y}-${pad(q)}-01`, hasta: hoy };
    }
    case '12m': {
      const yy = m === 12 ? y : y - 1;
      const mm = m === 12 ? 1 : m + 1;
      return { desde: `${yy}-${pad(mm)}-01`, hasta: hoy };
    }
    case 'anio_anterior':
      return { desde: `${y - 1}-01-01`, hasta: `${y - 1}-12-31` };
    case 'anio':
    default:
      return { desde: `${y}-01-01`, hasta: hoy };
  }
}
export const PERIODOS = [
  ['mes', 'Este mes'],
  ['mes_anterior', 'Mes anterior'],
  ['trimestre', 'Este trimestre'],
  ['anio', 'Este año'],
  ['12m', 'Últimos 12 meses'],
  ['anio_anterior', 'Año anterior'],
  ['otro', 'Otras fechas'],
];

// CSV download (semicolon + BOM so Excel in Spanish opens it with accents and columns right)
export function downloadCsv(filename, header, rows) {
  const esc = (v) => {
    if (v == null) return '';
    const s = typeof v === 'number' ? String(v).replace('.', ',') : String(v);
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const body = [header, ...rows].map((r) => r.map(esc).join(';')).join('\r\n');
  const blob = new Blob(['﻿' + body], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 500);
}

// Parse a number typed the Colombian way: "1.250.000" or "1250000,50" or "12,5"
export function parseNum(s) {
  if (s === '' || s == null) return NaN;
  if (typeof s === 'number') return s;
  let t = String(s).trim().replace(/\s|\$/g, '');
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(t)) t = t.replace(/\./g, '').replace(',', '.');
  else t = t.replace(',', '.');
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
}

// Same maths as the server (functions/_lib/util.js ivaSplit), for the live preview in the form.
export function ivaSplit(cantidad, precio, incluye, tarifa) {
  const sub = cantidad * precio;
  const t = tarifa / 100;
  if (incluye) {
    const total = Math.round(sub);
    const base = Math.round(total / (1 + t));
    return { base, iva: total - base, total };
  }
  const base = Math.round(sub);
  const iva = Math.round(base * t);
  return { base, iva, total: base + iva };
}
