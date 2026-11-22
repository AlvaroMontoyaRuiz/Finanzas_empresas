// PUT /api/activos/:id   correct an asset (administrator)
import { route, json, fail, first } from '../../_lib/util.js';
import { updateSql } from '../../_lib/records.js';
import { parseActivo } from './index.js';

export const onRequestPut = route(async ({ env, body, params }) => {
  const row = await first(env, `SELECT id FROM activos WHERE id = ?`, [Number(params.id)]);
  if (!row) fail('not_found', 404);
  const v = await parseActivo(env, body);
  const { sql, args } = updateSql('activos', v, row.id);
  await env.DB.prepare(sql).bind(...args).run();
  return json({ ok: true });
}, { admin: true });
