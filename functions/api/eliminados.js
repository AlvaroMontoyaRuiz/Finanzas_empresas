// GET /api/eliminados?table&desde&hasta   administrator only
import { route, all, json, isDate } from '../_lib/util.js';

export const onRequestGet = route(async ({ env, url }) => {
  const where = [];
  const args = [];
  const t = url.searchParams.get('table');
  if (t === 'ingresos' || t === 'gastos') { where.push('d.table_name = ?'); args.push(t); }
  const d1 = url.searchParams.get('desde');
  const d2 = url.searchParams.get('hasta');
  if (isDate(d1)) { where.push(`date(d.deleted_at, '-5 hours') >= ?`); args.push(d1); }
  if (isDate(d2)) { where.push(`date(d.deleted_at, '-5 hours') <= ?`); args.push(d2); }
  const rows = await all(
    env,
    `SELECT d.*, u.display_name AS eliminado_por FROM deletion_log d LEFT JOIN users u ON u.id = d.deleted_by
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY d.deleted_at DESC, d.id DESC LIMIT 500`,
    args
  );
  return json({ rows: rows.map((r) => ({ ...r, payload: JSON.parse(r.payload_json) })) });
}, { admin: true });
