// PUT /api/personales/:id   correct a personal movement (administrator)
import { route, json, fail, first } from '../../_lib/util.js';
import { updateSql } from '../../_lib/records.js';
import { parsePersonal } from './index.js';

export const onRequestPut = route(async ({ env, body, params }) => {
  const row = await first(env, `SELECT id FROM personales WHERE id = ?`, [Number(params.id)]);
  if (!row) fail('not_found', 404);
  const { sql, args } = updateSql('personales', parsePersonal(body), row.id);
  await env.DB.prepare(sql).bind(...args).run();
  return json({ ok: true });
}, { admin: true });
