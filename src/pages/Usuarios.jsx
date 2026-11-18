import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { useApp } from '../App.jsx';
import { whenLabel } from '../lib/format.js';
import { Panel, PageHeader, Modal, ErrorBox, Skeleton, IconPlus } from '../components/ui.jsx';
import { PasswordField } from '../components/AuthShell.jsx';

export default function Usuarios() {
  const { user } = useApp();
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState('');
  const [modal, setModal] = useState(null); // 'new' | { edit: row } | { del: row }
  const load = useCallback(() => api.get('/api/usuarios').then((r) => setRows(r.usuarios)).catch((e) => setErr(e.message)), []);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Usuarios"
        subtitle="Quién puede entrar. El administrador ve todo; los usuarios registran ingresos y gastos."
        action={<button className="btn btn-primary" onClick={() => setModal('new')}><IconPlus /> Nuevo usuario</button>}
      />
      <Panel>
        {err && <p className="text-alert text-sm">{err}</p>}
        {!rows ? <Skeleton className="h-32" /> : (
          <ul className="divide-y divide-line">
            {rows.map((u) => (
              <li key={u.id} className="py-3 flex flex-wrap items-center gap-3 justify-between">
                <div>
                  <div className="font-semibold">
                    {u.display_name} {u.id === user.id && <span className="text-xs text-ink-faint font-normal">(tú)</span>}
                  </div>
                  <div className="text-sm text-ink-soft">
                    Usuario <b className="text-ink">{u.username}</b> ·{' '}
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${u.role === 'admin' ? 'bg-ink text-white' : 'bg-[#E3EFE8] text-farm-green'}`}>
                      {u.role === 'admin' ? 'Administrador' : 'Usuario'}
                    </span>{' '}
                    · desde {whenLabel(u.created_at)}
                  </div>
                </div>
                <div className="flex gap-1">
                  <button className="text-farm-green font-medium text-sm underline underline-offset-2 px-2 min-h-[40px]" onClick={() => setModal({ edit: u })}>Editar</button>
                  {u.id !== user.id && <button className="btn-link-danger" onClick={() => setModal({ del: u })}>Eliminar</button>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {modal === 'new' && <UserForm onClose={() => setModal(null)} onSaved={() => { setModal(null); load(); }} />}
      {modal?.edit && <UserForm u={modal.edit} self={modal.edit.id === user.id} onClose={() => setModal(null)} onSaved={() => { setModal(null); load(); }} />}
      {modal?.del && <DeleteUser u={modal.del} onClose={() => setModal(null)} onDone={() => { setModal(null); load(); }} />}
    </div>
  );
}

function UserForm({ u, self, onClose, onSaved }) {
  const [f, setF] = useState({ username: u?.username || '', displayName: u?.display_name || '', password: '', role: u?.role || 'usuario' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const ok = u ? !f.password || f.password.length >= 6 : f.username.trim() && f.password.length >= 6;

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      if (u) await api.put(`/api/usuarios/${u.id}`, { displayName: f.displayName, role: f.role, password: f.password || undefined });
      else await api.post('/api/usuarios', f);
      onSaved();
    } catch (x) {
      setErr(x.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={u ? `Editar ${u.display_name}` : 'Nuevo usuario'} onClose={onClose}>
      <form onSubmit={save} className="space-y-4">
        {!u && (
          <label className="block">
            <span className="label">Usuario (para ingresar)</span>
            <input className="field" value={f.username} autoCapitalize="none" autoCorrect="off" spellCheck={false} onChange={(e) => setF({ ...f, username: e.target.value })} />
          </label>
        )}
        <label className="block">
          <span className="label">Nombre que se muestra</span>
          <input className="field" value={f.displayName} onChange={(e) => setF({ ...f, displayName: e.target.value })} />
        </label>
        <label className="block">
          <span className="label">Rol</span>
          <select className="field" value={f.role} disabled={self} onChange={(e) => setF({ ...f, role: e.target.value })}>
            <option value="usuario">Usuario (registra ingresos y gastos)</option>
            <option value="admin">Administrador (ve todo)</option>
          </select>
        </label>
        <div>
          <span className="label">{u ? 'Nueva contraseña (déjala vacía para no cambiarla)' : 'Contraseña'}</span>
          <PasswordField id="pw" value={f.password} onChange={(v) => setF({ ...f, password: v })} autoComplete="new-password" placeholder="Mínimo 6" label="Contraseña" />
        </div>
        <ErrorBox>{err}</ErrorBox>
        <div className="grid grid-cols-2 gap-3">
          <button type="button" className="btn btn-quiet" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" disabled={busy || !ok}>{busy ? 'Guardando…' : 'Guardar'}</button>
        </div>
      </form>
    </Modal>
  );
}

function DeleteUser({ u, onClose, onDone }) {
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  async function go() {
    setBusy(true);
    try {
      await api.del(`/api/usuarios/${u.id}`);
      onDone();
    } catch (x) {
      setErr(x.message);
      setBusy(false);
    }
  }
  return (
    <Modal title={`¿Eliminar a ${u.display_name}?`} onClose={onClose}>
      <p className="text-ink-soft">Ya no podrá ingresar. Los ingresos y gastos que registró se conservan.</p>
      <div className="mt-3"><ErrorBox>{err}</ErrorBox></div>
      <div className="grid grid-cols-2 gap-3 mt-5">
        <button className="btn btn-quiet" onClick={onClose}>Cancelar</button>
        <button className="btn btn-danger" onClick={go} disabled={busy}>{busy ? 'Eliminando…' : 'Sí, eliminar'}</button>
      </div>
    </Modal>
  );
}
