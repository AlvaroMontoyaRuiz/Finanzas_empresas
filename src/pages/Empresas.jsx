import { useState } from 'react';
import { api } from '../lib/api.js';
import { useApp } from '../App.jsx';
import { Panel, PageHeader, ErrorBox } from '../components/ui.jsx';

// Administrator: rename the companies, change their color and choose which ones
// can leave sales "pendiente por cobrar".
export default function Empresas() {
  const { empresas, reloadEmpresas } = useApp();
  return (
    <div className="space-y-5">
      <PageHeader title="Empresas" subtitle="Nombre, color y si la empresa puede dejar ventas pendientes por cobrar." />
      <div className="grid md:grid-cols-2 gap-5">
        {empresas.map((e) => (
          <EmpresaCard key={e.id + e.nombre + e.color + e.cobra_pendientes + '-' + e.ingreso_diario} e={e} onSaved={reloadEmpresas} />
        ))}
      </div>
    </div>
  );
}

function EmpresaCard({ e, onSaved }) {
  const [f, setF] = useState({ nombre: e.nombre, color: e.color, cobra_pendientes: !!e.cobra_pendientes, ingreso_diario: !!e.ingreso_diario });
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const dirty = f.nombre !== e.nombre || f.color.toLowerCase() !== e.color.toLowerCase() || f.cobra_pendientes !== !!e.cobra_pendientes || f.ingreso_diario !== !!e.ingreso_diario;

  async function save() {
    setBusy(true);
    setErr('');
    setMsg('');
    try {
      await api.put(`/api/empresas/${e.id}`, f);
      setMsg('Guardado.');
      onSaved();
    } catch (x) {
      setErr(x.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel>
      <div className="flex items-center gap-3 mb-4">
        <span className="w-4 h-4 rounded-full" style={{ background: f.color }} aria-hidden />
        <h2 className="font-display font-semibold text-lg">{e.nombre}</h2>
      </div>
      <div className="grid grid-cols-[1fr_auto] gap-3">
        <label className="block">
          <span className="label">Nombre</span>
          <input className="field" value={f.nombre} maxLength={40} onChange={(x) => setF({ ...f, nombre: x.target.value })} />
        </label>
        <label className="block">
          <span className="label">Color</span>
          <input type="color" className="h-12 w-16 rounded-xl border border-line bg-white p-1" value={f.color} onChange={(x) => setF({ ...f, color: x.target.value })} />
        </label>
      </div>
      <label className="mt-4 flex items-start gap-3 cursor-pointer">
        <input type="checkbox" className="mt-1 w-5 h-5 accent-[#1F7A4D]" checked={f.ingreso_diario} onChange={(x) => setF({ ...f, ingreso_diario: x.target.checked, cobra_pendientes: x.target.checked ? true : f.cobra_pendientes })} />
        <span>
          <span className="font-medium">Solo registra el total de cada día</span>
          <span className="block text-sm text-ink-soft">Sin cliente, cantidad ni precio. Se anota lo que entró en Efectivo, Nequi y Desposte (el desposte queda por cobrar).</span>
        </span>
      </label>
      <label className="mt-4 flex items-start gap-3 cursor-pointer">
        <input type="checkbox" className="mt-1 w-5 h-5 accent-[#1F7A4D]" checked={f.cobra_pendientes} disabled={f.ingreso_diario} onChange={(x) => setF({ ...f, cobra_pendientes: x.target.checked })} />
        <span>
          <span className="font-medium">Puede dejar ventas pendientes por cobrar</span>
          <span className="block text-sm text-ink-soft">Al registrar un ingreso se elige si ya se pagó o si está pendiente. Aparece en “Por cobrar”.</span>
        </span>
      </label>
      <div className="mt-4"><ErrorBox>{err}</ErrorBox></div>
      <div className="flex items-center gap-3 mt-4">
        <button className="btn btn-primary" disabled={!dirty || busy || !f.nombre.trim()} onClick={save}>{busy ? 'Guardando…' : 'Guardar'}</button>
        {msg && !dirty && <span className="text-sm text-farm-green">{msg}</span>}
      </div>
    </Panel>
  );
}
