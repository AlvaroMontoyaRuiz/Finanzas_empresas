// Shared helpers for the API: request wrapper, validation and money maths.
import { requireUser, requireAdmin, json } from './auth.js';

// Wraps a handler: checks the session (and admin role if asked) and turns thrown
// Responses into replies.  handler({ request, env, params, user, body, url })
export function route(handler, { admin = false } = {}) {
  return async (ctx) => {
    try {
      const user = await requireUser(ctx.request, ctx.env);
      if (admin) requireAdmin(user);
      let body = null;
      if (!['GET', 'HEAD'].includes(ctx.request.method)) body = await ctx.request.json().catch(() => ({}));
      return await handler({ ...ctx, user, body: body || {}, url: new URL(ctx.request.url) });
    } catch (e) {
      if (e instanceof Response) return e;
      throw e;
    }
  };
}

export const fail = (error, status = 400, extra = {}) => {
  throw json({ error, ...extra }, status);
};

// Today in Colombia (UTC-5, no daylight saving)
export function todayCO() {
  return new Date(Date.now() - 5 * 3600 * 1000).toISOString().slice(0, 10);
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export function isDate(s) {
  if (typeof s !== 'string' || !DATE_RE.test(s)) return false;
  const d = new Date(s + 'T00:00:00Z');
  return !isNaN(d) && d.toISOString().slice(0, 10) === s;
}

export function text(v, max = 200) {
  if (v == null) return '';
  return String(v).trim().slice(0, max);
}

export function number(v) {
  if (v === '' || v == null) return NaN;
  const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : NaN;
}

export const round2 = (n) => Math.round(n * 100) / 100;

// Colombian IVA rates accepted by the app: exento/excluido 0 %, 5 %, 19 %.
export const IVA_TARIFAS = [0, 5, 19];

// From quantity × unit price, whether that price already includes IVA, and the rate,
// returns base (sin IVA), IVA and total (con IVA), rounded to whole pesos.
export function ivaSplit(cantidad, precioUnitario, incluyeIva, tarifa) {
  const sub = cantidad * precioUnitario;
  const t = tarifa / 100;
  let base, iva, total;
  if (incluyeIva) {
    total = Math.round(sub);
    base = Math.round(total / (1 + t));
    iva = total - base;
  } else {
    base = Math.round(sub);
    iva = Math.round(base * t);
    total = base + iva;
  }
  return { base, iva, total };
}

export async function empresaById(env, id) {
  return env.DB.prepare(`SELECT * FROM empresas WHERE id = ?`).bind(Number(id)).first();
}

// Shared filters for list / dashboard endpoints: ?desde=&hasta=&empresa=
export function rangeFilters(url, alias = '') {
  const p = alias ? alias + '.' : '';
  const where = [];
  const args = [];
  const desde = url.searchParams.get('desde');
  const hasta = url.searchParams.get('hasta');
  const empresa = url.searchParams.get('empresa');
  if (desde && isDate(desde)) { where.push(`${p}fecha >= ?`); args.push(desde); }
  if (hasta && isDate(hasta)) { where.push(`${p}fecha <= ?`); args.push(hasta); }
  if (empresa && Number(empresa) > 0) { where.push(`${p}empresa_id = ?`); args.push(Number(empresa)); }
  return { where, args, desde, hasta, empresa: empresa ? Number(empresa) : null };
}

export const whereSql = (w) => (w.length ? 'WHERE ' + w.join(' AND ') : '');

export async function all(env, sql, args = []) {
  const r = await env.DB.prepare(sql).bind(...args).all();
  return r.results || [];
}
export async function first(env, sql, args = []) {
  return env.DB.prepare(sql).bind(...args).first();
}

export { json };
