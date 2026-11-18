// Runs before every /api/* route.
//  - db_binding_missing : the D1 binding named "DB" is not attached to the Pages project
//  - creates the tables the first time (no SQL to run by hand)
import { json } from '../_lib/auth.js';
import { ensureSchema } from '../_lib/schema.js';

export const onRequest = async ({ env, next }) => {
  if (!env.DB) return json({ error: 'db_binding_missing' }, 500);
  try {
    await ensureSchema(env);
    return await next();
  } catch (e) {
    if (e instanceof Response) return e;
    const msg = String(e && e.message ? e.message : e);
    console.error('API error:', msg);
    if (/no such table/i.test(msg)) return json({ error: 'db_not_initialized' }, 500);
    return json({ error: 'server_error' }, 500);
  }
};
