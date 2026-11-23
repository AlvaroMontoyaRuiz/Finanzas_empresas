import { NavLink } from 'react-router-dom';

// Switch between the two "cuentas" pages: what customers owe (Por cobrar) and what is owed to suppliers (Por pagar).
export default function CuentasTabs() {
  const cls = ({ isActive }) =>
    `flex-1 sm:flex-none px-5 min-h-[44px] inline-flex items-center justify-center rounded-full font-semibold text-[15px] transition-colors ${
      isActive ? 'bg-white text-ink shadow-sm' : 'text-ink-soft hover:text-ink'
    }`;
  return (
    <nav aria-label="Cuentas" className="flex sm:inline-flex bg-[#E8ECE3] rounded-full p-1 w-full sm:w-auto">
      <NavLink to="/por-cobrar" className={cls}>Por cobrar</NavLink>
      <NavLink to="/por-pagar" className={cls}>Por pagar</NavLink>
    </nav>
  );
}
