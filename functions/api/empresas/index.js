// GET /api/empresas   the 4 businesses (everyone)
import { route, all, json } from '../../_lib/util.js';

export const onRequestGet = route(async ({ env }) => {
  const rows = await all(env, `SELECT id, slug, nombre, color, cobra_pendientes FROM empresas ORDER BY orden, id`);
  return json({ empresas: rows });
});
