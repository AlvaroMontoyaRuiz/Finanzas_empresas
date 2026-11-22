# 💼 Finanzas Empresas

Web app to record and visualize **income (ingresos)** and **expenses (gastos)** of the owner's four businesses:
**Finca, Carnicería, Camión and Palmiste**. The whole interface is in Spanish (Colombia, pesos COP).
Same stack and look as [Farm_dashboard](https://github.com/AlvaroMontoyaRuiz/Farm_dashboard).

## What it does

| Screen | Who | What |
|---|---|---|
| **Panel** | admin | Ingresos, gastos, utilidad and por cobrar (with % vs. previous period) · ingresos vs gastos per month (chart + table) · each company's income/expenses/profit · gastos por categoría · mejores clientes · ingresos por concepto · principales proveedores · cartera por antigüedad. Filter by period and company. |
| **Ingresos** | all | Fecha, empresa, cliente / de quién viene, concepto / origen, cantidad + unidad, precio unitario → total, medio de pago. **Carnicería is different**: it only records the **total of each day** by way of payment — **Efectivo, Nequi or Desposte** (no client, quantity or unit price). One form saves the whole day. Filters, search, correct, delete, CSV export. |
| **Gastos** | all | Same fields + proveedor, NIT, nº factura, categoría. The price can be typed **with IVA included or without IVA**, rate **0 %, 5 % or 19 %**; base, IVA and total are stored separately. |
| **Por cobrar** | all | Carnicería's **despostes** (max. 5 per day; each one records its value and the part paid in cash, the rest is what is owed): each one stays pending (optional expected payment date and detail) until someone taps *Marcar pagado* and gives the payment date. A *Ya pagados* view shows the ones already collected, with *Volver a pendiente* to fix a mistake. Overdue ones are flagged. |
| **Balance** | admin | **Activo** (por cobrar automático + activos que registras: bancos, inventario, vehículos…), **Pasivo** (tabla de deudas con personas: acreedor, concepto, valor, abonos, saldo, fecha límite), **Patrimonio** (activo − pasivo), **Ingresos/Egresos** del periodo y **Deuda** (lo que te deben vs. lo que debes). Resumen de *a quién le debo*. |
| **Impuestos** | admin | Per year: IVA paid per **bimestre**, per rate and per company, purchases per proveedor (NIT, base, IVA) for exógena, warning for expenses without invoice number, CSV export for the accountant. |
| **Empresas** | admin | Rename, change color, choose which companies record only the day's total (Carnicería by default) and which may leave sales pending. |
| **Usuarios** | admin | Add users, change passwords/roles, remove users. |
| **Eliminados** | admin | Every deleted record is copied here with who deleted it and why. |

Roles: **administrador** sees everything; **usuario** registers ingresos/gastos, marks sales as paid, and can correct or delete only what they registered.

## Stack

- **Frontend**: React + Vite + Tailwind + Recharts (`src/`)
- **Backend**: Cloudflare Pages Functions (`functions/`)
- **Database**: Cloudflare D1 (SQLite). **The app creates its own tables** on the first request (`functions/_lib/schema.js`) — no SQL to run.
- **Hosting**: Cloudflare Pages, free tier.

## Deploy to Cloudflare Pages

1. **Create the D1 database**: Cloudflare dashboard → *Storage & Databases → D1 → Create* → name `finanzas-db`.
   Copy its **Database ID** into `wrangler.toml` (`database_id = ...`), commit and push.
2. **Create the Pages project**: *Workers & Pages → Create → Pages → Connect to Git* → pick this repo.
   - Framework preset: *None* (or Vite) · Build command: `npm run build` · Output directory: `dist`
3. The `DB` binding comes from `wrangler.toml`. Deploy.
4. Open `https://<project>.pages.dev/setup` and create the administrator (+ up to 3 users). After that `/setup` is disabled.

## Local development

```bash
npm install
npm run build && npm run pages:dev      # http://localhost:8788 (API + built site, local D1)
# or, for hot reload: terminal A `npm run dev` (5173, proxies /api) + terminal B `npm run pages:dev`
```

## Notes

- Money is stored in whole pesos. IVA maths (`ivaSplit` in `functions/_lib/util.js`, mirrored in `src/lib/format.js`):
  - price **includes** IVA: `total = cantidad × precio`, `base = total ÷ (1 + tarifa)`, `IVA = total − base`
  - price **without** IVA: `base = cantidad × precio`, `IVA = base × tarifa`, `total = base + IVA`
- Ingresos count on their sale date (accrual); *cobrado / por cobrar* tells them apart.
- Start from zero (deletes all records and users, keeps the companies): `npm run db:remote:reset`, then `/setup` again.
- Passwords: salted SHA-256, sessions in HttpOnly cookies (7 days) — same as Farm_dashboard.
- The tax screens are an aid for organizing information; deductibility and IVA descontable depend on each company's regime — confirm with the accountant.
