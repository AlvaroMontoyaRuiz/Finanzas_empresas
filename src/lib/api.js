import { cop } from './format.js';

// Tiny fetch wrapper. All API calls go through here so cookies travel.
// Also translates server error codes into Spanish messages for the UI.

const ERRORS_ES = {
  not_authenticated: 'Debes iniciar sesión.',
  invalid_session: 'Tu sesión ya no es válida. Vuelve a iniciar sesión.',
  session_expired: 'Tu sesión expiró. Vuelve a iniciar sesión.',
  admin_only: 'Solo el administrador puede hacer esto.',
  invalid_credentials: 'Usuario o contraseña incorrectos.',
  missing_credentials: 'Faltan datos de usuario o contraseña.',
  invalid_json: 'La solicitud no es válida.',
  already_initialized: 'Los usuarios ya fueron creados. No se puede volver a configurar.',
  admin_required: 'Debes definir un administrador.',
  too_many_users: 'Se alcanzó el máximo de usuarios.',
  username_taken: 'Ese nombre de usuario ya existe.',
  password_too_short: 'La contraseña debe tener al menos 6 caracteres.',
  bad_empresa: 'Elige una empresa.',
  bad_date: 'La fecha no es válida.',
  bad_cantidad: 'La cantidad debe ser mayor que 0.',
  bad_precio: 'Escribe un precio válido (0 o más).',
  bad_concepto: 'Escribe el concepto (qué se vendió o se compró).',
  bad_monto: 'Escribe un valor mayor que 0.',
  sin_montos: 'Escribe el valor de al menos una forma de pago (efectivo, Nequi o desposte).',
  bad_abono: 'El efectivo recibido no es válido.',
  abono_mayor_total: 'El efectivo recibido no puede ser mayor que el valor del desposte.',
  max_despostes: (d) => `Máximo 5 despostes por día${d.ya ? ` (ese día ya hay ${d.ya})` : ''}.`,
  sin_saldo: 'Este desposte se pagó completo en efectivo: no queda nada por cobrar.',
  bad_acreedor: 'Escribe a quién se le debe.',
  bad_tipo: 'Elige el tipo.',
  bad_categoria: 'Elige una categoría.',
  bad_descripcion: 'Escribe una descripción.',
  bad_valor: 'Escribe un valor válido (0 o más).',
  monto_menor_abonos: (d) => `El monto no puede ser menor que lo ya abonado (${cop(d.abonado)}).`,
  abono_mayor_saldo: (d) => `El abono no puede ser mayor que lo que falta por pagar (${cop(d.saldo)}).`,
  bad_cliente: 'Escribe el nombre del cliente o de quién viene el ingreso.',
  bad_proveedor: 'Escribe el nombre del proveedor.',
  bad_categoria: 'Elige o escribe una categoría.',
  bad_iva: 'La tarifa de IVA debe ser 0 %, 5 % o 19 %.',
  bad_nombre: 'Escribe un nombre.',
  nombre_taken: 'Ya existe una empresa con ese nombre.',
  has_pendientes: (d) => `Esta empresa tiene ${d.n} ${d.n === 1 ? 'venta pendiente' : 'ventas pendientes'} por cobrar. Márcalas como pagadas primero.`,
  no_pendientes: 'Esta empresa no maneja ventas pendientes por cobrar.',
  pago_before_sale: 'La fecha de pago no puede ser anterior a la fecha de la venta.',
  bad_table: 'Tabla no válida.',
  bad_id: 'ID no válido.',
  not_found: 'El registro no existe.',
  not_your_record: 'Solo puedes cambiar o eliminar lo que tú registraste. Pídele al administrador que lo corrija.',
  last_admin: 'Debe quedar al menos un administrador (y no puedes quitarte el rol a ti mismo).',
  cannot_delete_self: 'No puedes eliminar tu propio usuario.',
  db_binding_missing: 'La base de datos no está conectada al proyecto (falta el binding "DB" en Cloudflare).',
  db_not_initialized: 'La base de datos no se pudo preparar. Recarga la página.',
  server_error: 'Error interno del servidor. Intenta de nuevo.',
};

export function translateError(code, data) {
  if (!code) return 'Ocurrió un error.';
  const m = ERRORS_ES[code];
  if (typeof m === 'function') return m(data || {});
  return m || `Error: ${code}`;
}

async function request(method, path, body) {
  let res;
  try {
    res = await fetch(path, {
      method,
      credentials: 'include',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error('Sin conexión. Revisa el internet e intenta de nuevo.');
  }
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    const code = data?.error || `HTTP_${res.status}`;
    const err = new Error(translateError(code, data));
    err.status = res.status;
    err.code = code;
    err.data = data;
    if (res.status === 401 && path !== '/api/auth/me' && path !== '/api/auth/login') {
      window.dispatchEvent(new Event('auth:expired'));
    }
    throw err;
  }
  return data;
}

export const api = {
  get: (p) => request('GET', p),
  post: (p, b) => request('POST', p, b),
  put: (p, b) => request('PUT', p, b),
  del: (p, b) => request('DELETE', p, b),
};

export const qs = (o) => {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(o)) if (v !== '' && v != null && v !== 0) q.set(k, v);
  const s = q.toString();
  return s ? '?' + s : '';
};
