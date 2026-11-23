import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Routes, Route, Navigate, NavLink, Link, useNavigate, useLocation } from 'react-router-dom';
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
import PorPagar from './pages/PorPagar.jsx';
import { IPanel, IIngreso, IGasto, ICuentas, ICobrar, IPagar, IBalance, IImpuestos, IEmpresas, IUsuarios, IEliminados, IMas, ISalir, IPlus, IChevron } from './components/icons.jsx';

// The 4 businesses + the logged-in user, available to every page.
const AppCtx = createContext(null);
export const useApp = () => useContext(AppCtx);

export default function App() {
  const [user, setUser] = useState(undefined); // undefined=loading, null=anon
  const [empresas, setEmpresas] = useState([]);
  const [pendientes, setPendientes] = useState(0);
  const [porPagar, setPorPagar] = useState(0);
  const nav = useNavigate();
  const loc = useLocation();

  useEffect(() => {
    api.get('/api/auth/me').then((r) => setUser(r.user)).catch(() => setUser(null));
    const expired = () => setUser(null);
    window.addEventListener('auth:expired', expired);
    return () => window.removeEventListener('auth:expired', expired);
  }, []);

  const loadEmpresas = useCallback(() => api.get('/api/empresas').then((r) => setEmpresas(r.empresas)).catch(() => {}), []);
  const loadPendientes = useCallback(() => {
    api.get('/api/ingresos?estado=pendiente&limit=1').then((r) => setPendientes(r.totales.n)).catch(() => {});
    api.get('/api/proveedores?estado=abiertas').then((r) => setPorPagar(r.totales.n)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!user) return undefined;
    loadEmpresas();
    loadPendientes();
    window.addEventListener('ingresos:changed', loadPendientes);
    window.addEventListener('balance:changed', loadPendientes);
    return () => {
      window.removeEventListener('ingresos:changed', loadPendientes);
      window.removeEventListener('balance:changed', loadPendientes);
    };
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

  return (
    <AppCtx.Provider value={{ user, empresas, reloadEmpresas: loadEmpresas }}>
      <Shell user={user} admin={admin} counts={{ cobrar: pendientes, pagar: porPagar }} onLogout={logout}>
        <Routes>
          <Route path="/" element={onlyAdmin(<Panel />)} />
          <Route path="/ingresos" element={<Ingresos />} />
          <Route path="/gastos" element={<Gastos />} />
          <Route path="/por-cobrar" element={<PorCobrar />} />
          <Route path="/por-pagar" element={<PorPagar />} />
          <Route path="/balance" element={onlyAdmin(<Balance />)} />
          <Route path="/impuestos" element={onlyAdmin(<Impuestos />)} />
          <Route path="/empresas" element={onlyAdmin(<Empresas />)} />
          <Route path="/usuarios" element={onlyAdmin(<Usuarios />)} />
          <Route path="/eliminados" element={onlyAdmin(<Eliminados />)} />
          <Route path="*" element={<Navigate to={home} replace />} />
        </Routes>
      </Shell>
    </AppCtx.Provider>
  );
}

/* ---------------- Navigation ---------------- */

// All sections, grouped. `admin` = only the administrator sees it.
const SECCIONES = [
  { grupo: 'Resumen', items: [
    { to: '/', label: 'Panel', icon: IPanel, admin: true, end: true },
    { to: '/balance', label: 'Balance', icon: IBalance, admin: true },
  ] },
  { grupo: 'Movimientos', items: [
    { to: '/ingresos', label: 'Ingresos', icon: IIngreso },
    { to: '/gastos', label: 'Gastos', icon: IGasto },
  ] },
  { grupo: 'Cuentas', items: [
    { to: '/por-cobrar', label: 'Por cobrar', icon: ICobrar, count: 'cobrar' },
    { to: '/por-pagar', label: 'Por pagar', icon: IPagar, count: 'pagar' },
  ] },
  { grupo: 'Reportes y ajustes', items: [
    { to: '/impuestos', label: 'Impuestos', icon: IImpuestos, admin: true },
    { to: '/empresas', label: 'Empresas', icon: IEmpresas, admin: true },
    { to: '/usuarios', label: 'Usuarios', icon: IUsuarios, admin: true },
    { to: '/eliminados', label: 'Eliminados', icon: IEliminados, admin: true },
  ] },
];

const NUEVOS = [
  { to: '/ingresos?nuevo=1', label: 'Ingreso', hint: 'Una venta o el total del día', icon: IIngreso, tone: 'text-ingreso bg-[#E3EFE8]' },
  { to: '/gastos?nuevo=1', label: 'Gasto', hint: 'Una compra o un pago, con IVA', icon: IGasto, tone: 'text-gasto bg-[#FBEFD9]' },
  { to: '/por-pagar?nuevo=1', label: 'Factura de proveedor', hint: 'Para ir pagando con abonos', icon: IPagar, tone: 'text-[#5B3FA0] bg-[#EEE8F8]' },
];

const iniciales = (n = '') => n.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '·';

function Shell({ user, admin, counts, onLogout, children }) {
  const loc = useLocation();
  const [mas, setMas] = useState(false);
  const [nuevo, setNuevo] = useState(false);
  const secciones = SECCIONES.map((g) => ({ ...g, items: g.items.filter((i) => admin || !i.admin) })).filter((g) => g.items.length);
  const todas = secciones.flatMap((g) => g.items);
  const actual = todas.find((i) => (i.end ? loc.pathname === i.to : loc.pathname.startsWith(i.to))) || todas[0];
  useEffect(() => {
    setMas(false);
    setNuevo(false);
  }, [loc.pathname, loc.search]);

  // phone bottom bar: the daily sections; everything else goes under "Más"
  const enCuentas = loc.pathname.startsWith('/por-cobrar') || loc.pathname.startsWith('/por-pagar');
  const abajo = [
    ...(admin ? [{ to: '/', label: 'Panel', icon: IPanel, end: true }] : []),
    { to: '/ingresos', label: 'Ingresos', icon: IIngreso },
    { to: '/gastos', label: 'Gastos', icon: IGasto },
    { to: '/por-cobrar', label: 'Cuentas', icon: ICuentas, active: enCuentas, dot: counts.cobrar + counts.pagar > 0 },
  ];
  const enAbajo = new Set(['/', '/ingresos', '/gastos', '/por-cobrar', '/por-pagar']);
  const masItems = todas.filter((i) => !enAbajo.has(i.to));
  const masActivo = masItems.some((i) => loc.pathname.startsWith(i.to));

  return (
    <div className="min-h-full lg:pl-[264px]">
      {/* ---------- sidebar (computer) ---------- */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-[264px] flex-col bg-ink text-white z-30">
        <div className="px-6 pt-6 pb-5">
          <Marca />
        </div>
        <div className="px-4 pb-4">
          <button type="button" onClick={() => setNuevo(true)} className="w-full btn bg-white text-ink hover:bg-white/90">
            <IPlus /> Registrar
          </button>
        </div>
        <nav aria-label="Principal" className="flex-1 overflow-y-auto px-3 pb-4 space-y-5 no-scrollbar">
          {secciones.map((g) => (
            <div key={g.grupo}>
              <div className="px-3 mb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-white/40">{g.grupo}</div>
              <ul className="space-y-0.5">
                {g.items.map((i) => (
                  <li key={i.to}>
                    <NavLink
                      to={i.to}
                      end={i.end}
                      className={({ isActive }) =>
                        `group flex items-center gap-3 px-3 min-h-[44px] rounded-xl text-[15px] font-medium transition-colors ${
                          isActive ? 'bg-white/[0.12] text-white' : 'text-white/70 hover:text-white hover:bg-white/[0.06]'
                        }`
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <span className={`grid place-items-center ${isActive ? 'text-[#7FD3A6]' : ''}`}><i.icon /></span>
                          <span className="flex-1">{i.label}</span>
                          {i.count && counts[i.count] > 0 && <Badge n={counts[i.count]} />}
                        </>
                      )}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
        <div className="border-t border-white/10 p-4 flex items-center gap-3">
          <span className="w-10 h-10 rounded-full bg-white/10 grid place-items-center font-semibold text-sm shrink-0">{iniciales(user.displayName)}</span>
          <span className="flex-1 min-w-0">
            <span className="block truncate font-medium text-sm">{user.displayName}</span>
            <span className="block text-xs text-white/50">{admin ? 'Administrador' : 'Usuario'}</span>
          </span>
          <button type="button" onClick={onLogout} className="w-10 h-10 rounded-xl grid place-items-center text-white/60 hover:text-white hover:bg-white/10" aria-label="Salir" title="Salir">
            <ISalir />
          </button>
        </div>
      </aside>

      {/* ---------- top bar (phone / tablet) ---------- */}
      <header className="lg:hidden sticky top-0 z-30 bg-ink text-white">
        <div className="flex items-center justify-between gap-3 h-14 px-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <Logo />
            <span className="font-display font-semibold text-[17px] truncate">{actual?.label || 'Finanzas'}</span>
          </div>
          <button type="button" onClick={() => setNuevo(true)} className="inline-flex items-center gap-1.5 rounded-full bg-white text-ink font-semibold text-sm px-4 min-h-[40px]">
            <IPlus width={18} height={18} /> Registrar
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-10 pt-5 sm:pt-7 lg:pt-9 pb-28 lg:pb-12">
        {children}
      </main>

      {/* ---------- bottom tab bar (phone / tablet) ---------- */}
      <nav aria-label="Principal" className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur border-t border-line" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <ul className="flex max-w-xl mx-auto">
          {abajo.map((i) => (
            <li key={i.to} className="flex-1">
              <NavLink to={i.to} end={i.end} className={({ isActive }) => tabCls(i.active ?? isActive)}>
                <span className="relative">
                  <i.icon />
                  {i.dot && <span className="absolute -top-0.5 -right-1 w-2.5 h-2.5 rounded-full bg-alert ring-2 ring-white" aria-label="Hay pendientes" />}
                </span>
                {i.label}
              </NavLink>
            </li>
          ))}
          <li className="flex-1">
            <button type="button" onClick={() => setMas(true)} className={tabCls(masActivo) + ' w-full'} aria-haspopup="dialog">
              <IMas />
              Más
            </button>
          </li>
        </ul>
      </nav>

      {mas && (
        <Hoja titulo="Más opciones" onClose={() => setMas(false)}>
          {masItems.length > 0 && (
            <ul className="divide-y divide-line rounded-2xl border border-line overflow-hidden mb-4">
              {masItems.map((i) => (
                <li key={i.to}>
                  <NavLink to={i.to} className={({ isActive }) => `flex items-center gap-3 px-4 min-h-[56px] ${isActive ? 'bg-field font-semibold' : ''}`}>
                    <span className="text-ink-soft"><i.icon /></span>
                    <span className="flex-1">{i.label}</span>
                    <IChevron className="text-ink-faint" />
                  </NavLink>
                </li>
              ))}
            </ul>
          )}
          <div className="flex items-center gap-3 rounded-2xl bg-field px-4 py-3">
            <span className="w-10 h-10 rounded-full bg-ink text-white grid place-items-center font-semibold text-sm">{iniciales(user.displayName)}</span>
            <span className="flex-1 min-w-0">
              <span className="block truncate font-medium">{user.displayName}</span>
              <span className="block text-xs text-ink-soft">{admin ? 'Administrador' : 'Usuario'}</span>
            </span>
            <button type="button" onClick={onLogout} className="btn btn-quiet !min-h-[44px] text-sm"><ISalir width={18} height={18} /> Salir</button>
          </div>
        </Hoja>
      )}

      {nuevo && (
        <Hoja titulo="¿Qué quieres registrar?" onClose={() => setNuevo(false)}>
          <ul className="space-y-2">
            {NUEVOS.map((n) => (
              <li key={n.to}>
                <Link to={n.to} className="flex items-center gap-3.5 rounded-2xl border border-line px-4 py-3 hover:bg-field">
                  <span className={`w-11 h-11 rounded-xl grid place-items-center ${n.tone}`}><n.icon /></span>
                  <span className="flex-1">
                    <span className="block font-semibold">{n.label}</span>
                    <span className="block text-sm text-ink-soft">{n.hint}</span>
                  </span>
                  <IChevron className="text-ink-faint" />
                </Link>
              </li>
            ))}
          </ul>
        </Hoja>
      )}
    </div>
  );
}

const tabCls = (active) =>
  `flex flex-col items-center justify-center gap-0.5 min-h-[60px] text-[11.5px] font-semibold transition-colors ${
    active ? 'text-farm-green' : 'text-ink-faint hover:text-ink'
  }`;

function Badge({ n }) {
  return (
    <span className="min-w-[22px] h-[22px] px-1.5 rounded-full bg-alert text-white text-xs font-bold inline-grid place-items-center" aria-label={`${n} pendientes`}>
      {n > 99 ? '99+' : n}
    </span>
  );
}

function Logo() {
  return (
    <span className="w-8 h-8 rounded-[10px] bg-[#7FD3A6] text-ink grid place-items-center shrink-0" aria-hidden>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M4 18l5-6 4 3 7-9" /><path d="M15 6h5v5" /></svg>
    </span>
  );
}

function Marca() {
  const { empresas } = useApp();
  return (
    <div className="flex items-center gap-3">
      <Logo />
      <div className="leading-tight">
        <div className="font-display font-semibold text-[18px] tracking-tight">Finanzas</div>
        <div className="text-xs text-white/50">{empresas.length ? `${empresas.length} negocios` : 'Empresas'}</div>
      </div>
    </div>
  );
}

// Bottom sheet on phones, centered dialog on computers.
function Hoja({ titulo, onClose, children }) {
  useEffect(() => {
    const k = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 bg-ink/50 flex items-end sm:items-center justify-center sm:p-4" onClick={onClose} role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl p-5 shadow-panel"
        style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto w-10 h-1.5 rounded-full bg-line mb-4 sm:hidden" aria-hidden />
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-bold text-xl">{titulo}</h3>
          <button type="button" onClick={onClose} className="w-10 h-10 -mr-2 rounded-full hover:bg-field text-ink-soft text-xl" aria-label="Cerrar">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}
