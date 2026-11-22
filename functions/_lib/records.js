// Validation of ingreso / gasto bodies. Returns clean values or throws a JSON error.
import { fail, isDate, text, number, ivaSplit, IVA_TARIFAS, empresaById, todayCO } from './util.js';

export const MEDIOS_PAGO = ['efectivo', 'transferencia', 'nequi', 'daviplata', 'tarjeta', 'cheque', 'credito', 'otro'];
// Companies that only record the total of the day (Carnicería): how that money came in.
// 'desposte' is not paid yet: it stays "por cobrar" until someone marks it as paid.
export const MEDIOS_DIA = ['efectivo', 'nequi', 'desposte'];

async function common(env, b) {
  const empresa = await empresaById(env, b.empresa_id);
  if (!empresa) fail('bad_empresa');
  if (!isDate(b.fecha)) fail('bad_date');
  const cantidad = number(b.cantidad);
  if (!(cantidad > 0)) fail('bad_cantidad');
  const precio = number(b.precio_unitario);
  if (!(precio >= 0)) fail('bad_precio');
  const concepto = text(b.concepto, 160);
  if (!concepto) fail('bad_concepto');
  const medio = text(b.medio_pago, 30).toLowerCase();
  return {
    empresa,
    fecha: b.fecha,
    cantidad,
    unidad: text(b.unidad, 30) || null,
    precio_unitario: precio,
    concepto,
    medio_pago: MEDIOS_PAGO.includes(medio) ? medio : null,
    nota: text(b.nota, 500) || null,
  };
}

// "Total del día": one amount, one way of payment. No client, quantity or unit price.
function parseIngresoDia(empresa, b) {
  if (!isDate(b.fecha)) fail('bad_date');
  const monto = number(b.monto);
  if (!(monto > 0)) fail('bad_monto');
  const pedido = text(b.medio_pago, 30).toLowerCase();
  const medio = MEDIOS_DIA.includes(pedido) ? pedido : 'efectivo';
  const total = Math.round(monto);
  let estado = 'pagado';
  let fecha_pago = b.fecha;
  let fecha_vencimiento = null;
  if (medio === 'desposte') {
    if (b.estado === 'pagado') {
      fecha_pago = isDate(b.fecha_pago) && b.fecha_pago >= b.fecha ? b.fecha_pago : b.fecha;
    } else {
      estado = 'pendiente';
      fecha_pago = null;
      if (b.fecha_vencimiento) {
        if (!isDate(b.fecha_vencimiento)) fail('bad_date');
        fecha_vencimiento = b.fecha_vencimiento;
      }
    }
  }
  return {
    empresa_id: empresa.id,
    fecha: b.fecha,
    cliente: '',
    concepto: medio === 'desposte' ? 'Desposte' : 'Venta del día',
    cantidad: 1,
    unidad: null,
    precio_unitario: total,
    total,
    medio_pago: medio,
    estado,
    fecha_vencimiento,
    fecha_pago,
    nota: text(b.nota, 500) || null,
  };
}

export async function parseIngreso(env, b) {
  const empresa = await empresaById(env, b.empresa_id);
  if (!empresa) fail('bad_empresa');
  if (empresa.ingreso_diario) return parseIngresoDia(empresa, b);
  const c = await common(env, b);
  const cliente = text(b.cliente, 120);
  if (!cliente) fail('bad_cliente');
  let estado = b.estado === 'pendiente' ? 'pendiente' : 'pagado';
  if (!c.empresa.cobra_pendientes) estado = 'pagado';
  let fecha_pago = null;
  let fecha_vencimiento = null;
  if (estado === 'pagado') {
    fecha_pago = isDate(b.fecha_pago) ? b.fecha_pago : c.fecha;
  } else {
    if (b.fecha_vencimiento) {
      if (!isDate(b.fecha_vencimiento)) fail('bad_date');
      fecha_vencimiento = b.fecha_vencimiento;
    }
  }
  return {
    empresa_id: c.empresa.id,
    fecha: c.fecha,
    cliente,
    concepto: c.concepto,
    cantidad: c.cantidad,
    unidad: c.unidad,
    precio_unitario: c.precio_unitario,
    total: Math.round(c.cantidad * c.precio_unitario),
    medio_pago: c.medio_pago,
    estado,
    fecha_vencimiento,
    fecha_pago,
    nota: c.nota,
  };
}

export async function parseGasto(env, b) {
  const c = await common(env, b);
  const proveedor = text(b.proveedor, 120);
  if (!proveedor) fail('bad_proveedor');
  const categoria = text(b.categoria, 60);
  if (!categoria) fail('bad_categoria');
  const tarifa = number(b.iva_tarifa);
  if (!IVA_TARIFAS.includes(tarifa)) fail('bad_iva');
  const incluye = b.precio_incluye_iva ? 1 : 0;
  const { base, iva, total } = ivaSplit(c.cantidad, c.precio_unitario, incluye, tarifa);
  return {
    empresa_id: c.empresa.id,
    fecha: c.fecha,
    proveedor,
    nit: text(b.nit, 30) || null,
    factura: text(b.factura, 40) || null,
    categoria,
    concepto: c.concepto,
    cantidad: c.cantidad,
    unidad: c.unidad,
    precio_unitario: c.precio_unitario,
    precio_incluye_iva: incluye,
    iva_tarifa: tarifa,
    base,
    iva,
    total,
    medio_pago: c.medio_pago,
    nota: c.nota,
  };
}

// INSERT / UPDATE helpers from a clean object
export function insertSql(table, obj) {
  const cols = Object.keys(obj);
  return { sql: `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`, args: cols.map((k) => obj[k]) };
}
export function updateSql(table, obj, id) {
  const cols = Object.keys(obj);
  return {
    sql: `UPDATE ${table} SET ${cols.map((k) => `${k} = ?`).join(', ')}, updated_at = datetime('now') WHERE id = ?`,
    args: [...cols.map((k) => obj[k]), id],
  };
}

// Users may only change what they registered; the administrator can change anything.
export async function loadOwned(env, table, id, user) {
  const n = Number(id);
  if (!Number.isInteger(n) || n <= 0) fail('bad_id');
  const row = await env.DB.prepare(`SELECT * FROM ${table} WHERE id = ?`).bind(n).first();
  if (!row) fail('not_found', 404);
  if (user.role !== 'admin' && row.created_by !== user.id) fail('not_your_record', 403);
  return row;
}

export { todayCO };
