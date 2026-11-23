import { Field, NumberInput } from './fields.jsx';

// Entry for the company "Personal": the user types what it is and how much. No client, supplier, category or IVA.
export default function PersonalFields({ f, set, tipo }) {
  return (
    <>
      <Field label="Fecha" htmlFor="pe-fecha" className="sm:max-w-[260px]">
        <input id="pe-fecha" type="date" className="field" value={f.fecha} onChange={set('fecha')} max="2100-12-31" />
      </Field>
      <Field label="¿Qué tipo es?" htmlFor="pe-conc" hint={tipo === 'gasto' ? 'Escríbelo como quieras: ropa, mercado, salud…' : 'Escríbelo como quieras: premio de lotería, regalo, venta…'}>
        <input id="pe-conc" className="field" value={f.concepto} onChange={set('concepto')} placeholder={tipo === 'gasto' ? 'Ej: Ropa y zapatos' : 'Ej: Premio del chance'} />
      </Field>
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Valor" htmlFor="pe-monto">
          <NumberInput id="pe-monto" money value={f.monto} onChange={set('monto')} placeholder="0" />
        </Field>
        <Field label="Nota (opcional)" htmlFor="pe-nota">
          <input id="pe-nota" className="field" value={f.nota} onChange={set('nota')} />
        </Field>
      </div>
    </>
  );
}
