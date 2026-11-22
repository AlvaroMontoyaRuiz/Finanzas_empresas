import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Routes, Route, Navigate, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { api } from './lib/api.js';
import Login from './pages/Login.jsx';
import Setup from './pages/Setup.jsx';
import Panel from './pages/Panel.jsx';
import Ingresos from './pages/Ingresos.jsx';
import Gastos from './pages/Gastos.jsx';
import PorCobrar from './pages/PorCobrar.jsx';
import Balance from './pages/Balance.jsx';
import Impuestos from './pages/Impuestos.jsx';
import Empresas from './pages/Empresas.jsx';
import Usuarios from './pages/Usuarios.jsx';
import Eliminados from './pages/Eliminados.jsx';

// The 4 businesses + the logged-in user, available to every page.
const AppCtx = createContext(null);
export const useApp = () => useContext(AppCtx);

export default function App() {
  const [user, setUser] = useState(undefined); // undefined=loading, null=anon
  const [empresas, setEmpresas] = useState([]);
  const [pendientes, setPendientes] = useState(0);
  const nav = useNavigate();
  const loc = useLocation();

  useEffect(() => {
    api.get('/api/auth/me').then((r) => setUser(r.user)).catch(() => setUser(null));
    const expired = () => setUser(null);
    window.addEventListener('auth:expired', expired);
    return () => window.removeEventListener('auth:expired', expired);
  }, []);

  const loadEmpresas = useCallback(() => api.get('/api/empresas').then((r) => setEmpresas(r.empresas)).catch(() => {}), []);
  const loadPendientes = useCallback(
    () => api.get('/api/ingresos?estado=pendiente&limit=1').then((r) => setPendientes(r.totales.n)).catch(() => {}),
    []
  );

  useEffect(() => {
    if (!user) return undefined;
    loadEmpresas();
    loadPendientes();
    window.addEventListener('ingresos:changed', loadPendientes);
    return () => window.removeEventListener('ingresos:changed', loadPendientes);
  }, [user, loadEmpresas, loadPendientes]);

  async function logout() {
    await api.post('/api/auth/logout').catch(() => {});
    setUser(null);
    nav('/login');
  }

  if (user === undefined) return <div className="p-10 text-center text-ink-soft">Cargando…</div>;

  if (!user) {
    return (
      <Routes>
        <Route path="/setup" element={<Setup onDone={() => nav('/login')} />} />
        <Route path="/login" element={<Login onLogin={(u) => { setUser(u); nav('/'); }} />} />
        <Route path="*" element={<Navigate to="/login" replace state={{ from: loc }} />} />
      </Routes>
    );
  }

  const admin = user.role === 'admin';
  const home = admin ? '/' : '/ingresos';
  const onlyAdmin = (el) => (admin ? el : <Navigate to={home} replace />);
  const hayPendientes = empresas.some((e) => e.cobra_pendientes);

  return (
    <AppCtx.Provider value={{ user, empresas, reloadEmpresas: loadEmpresas }}>
      <div className="min-h-full flex flex-col">
        <header className="bg-ink text-white sticky top-0 z-30">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="flex items-center justify-between h-14 md:h-16">
              <div className="font-display font-semibold text-[18px] md:text-[20px] tracking-tight">Finanzas Empresas</div>
              <div className="flex items-center gap-3 text-sm">
                <span className="text-white/80 hidden md:inline">
                  {user.displayName} <span className="text-white/50">({admin ? 'Administrador' : 'Usuario'})</span>
                </span>
                <button onClick={logout} className="px-4 min-h-[40px] rounded-full bg-white/10 hover:bg-white/20 text-sm font-medium">
                  Salir
                </button>
              </div>
            </div>
            <nav aria-label="Principal" className="flex gap-1.5 pb-2.5 -mx-1 px-1 overflow-x-auto no-scrollbar text-[15px] md:text-base">
              {admin && <NavItem to="/" end>Panel</NavItem>}
              <NavItem to="/ingresos">Ingresos</NavItem>
              <NavItem to="/gastos">Gastos</NavItem>
              {hayPendientes && <NavItem to="/por-cobrar" badge={pendientes}>Por cobrar</NavItem>}
              {admin && (
                <>
                  <NavItem to="/balance">Balance</NavItem>
                  <NavItem to="/impuestos">Impuestos</NavItem>
                  <NavItem to="/empresas">Empresas</NavItem>
                  <NavItem to="/usuarios">Usuarios</NavItem>
                  <NavItem to="/eliminados">Eliminados</NavItem>
                </>
              )}
            </nav>
          </div>
        </header>

        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-5 sm:py-7">
          <Routes>
            <Route path="/" element={onlyAdmin(<Panel />)} />
            <Route path="/ingresos" element={<Ingresos />} />
            <Route path="/gastos" element={<Gastos />} />
            <Route path="/por-cobrar" element={<PorCobrar />} />
            <Route path="/balance" element={onlyAdmin(<Balance />)} />
            <Route path="/impuestos" element={onlyAdmin(<Impuestos />)} />
            <Route path="/empresas" element={onlyAdmin(<Empresas />)} />
            <Route path="/usuarios" element={onlyAdmin(<Usuarios />)} />
            <Route path="/eliminados" element={onlyAdmin(<Eliminados />)} />
            <Route path="*" element={<Navigate to={home} replace />} />
          </Routes>
        </main>

        <footer className="text-xs text-ink-faint text-center py-4">Finanzas Empresas{empresas.length ? ' · ' + empresas.map((e) => e.nombre).join(' · ') : ''}</footer>
      </div>
    </AppCtx.Provider>
  );
}

function NavItem({ to, end, children, badge = 0 }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `px-4 min-h-[44px] inline-flex items-center rounded-full whitespace-nowrap font-medium transition-colors ${
          isActive ? 'bg-white text-ink' : 'text-white/75 hover:text-white hover:bg-white/10'
        }`
      }
    >
      {children}
      {badge > 0 && (
        <span className="ml-2 min-w-[22px] h-[22px] px-1.5 rounded-full bg-alert text-white text-xs font-bold inline-grid place-items-center" aria-label={`${badge} pendientes`}>
          {badge}
        </span>
      )}
    </NavLink>
  );
}
