// Navigation icons (inline, currentColor, 24px grid).
const base = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.9, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };
export const IPanel = (p) => (<svg {...base} {...p}><rect x="3" y="3" width="7.5" height="9" rx="2" /><rect x="13.5" y="3" width="7.5" height="5.5" rx="2" /><rect x="13.5" y="11.5" width="7.5" height="9.5" rx="2" /><rect x="3" y="15" width="7.5" height="6" rx="2" /></svg>);
export const IIngreso = (p) => (<svg {...base} {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7.5v9M8 12.5l4 4 4-4" /></svg>);
export const IGasto = (p) => (<svg {...base} {...p}><circle cx="12" cy="12" r="9" /><path d="M12 16.5v-9M8 11.5l4-4 4 4" /></svg>);
export const ICuentas = (p) => (<svg {...base} {...p}><path d="M4 7.5A2.5 2.5 0 0 1 6.5 5h11A2.5 2.5 0 0 1 20 7.5v9a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5z" /><path d="M16 12h.01M4 9.5h16" /></svg>);
export const ICobrar = (p) => (<svg {...base} {...p}><path d="M4 7.5A2.5 2.5 0 0 1 6.5 5h11A2.5 2.5 0 0 1 20 7.5v9a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5z" /><path d="M9 12h6M12 9v6" /></svg>);
export const IPagar = (p) => (<svg {...base} {...p}><path d="M6 3h9l4 4v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" /><path d="M14 3v5h5M9 13h6M9 17h4" /></svg>);
export const IBalance = (p) => (<svg {...base} {...p}><path d="M12 4v16M5 20h14M6 8h12" /><path d="M6 8l-3 6a3 3 0 0 0 6 0zM18 8l-3 6a3 3 0 0 0 6 0z" /></svg>);
export const IImpuestos = (p) => (<svg {...base} {...p}><path d="M7 3h10a1 1 0 0 1 1 1v17l-3-2-3 2-3-2-3 2V4a1 1 0 0 1 1-1z" /><path d="M9.5 14.5l5-5M9.75 9.75h.01M14.25 14.25h.01" /></svg>);
export const IEmpresas = (p) => (<svg {...base} {...p}><path d="M3 21h18M5 21V8l7-4 7 4v13" /><path d="M9.5 21v-5h5v5M9 11h.01M15 11h.01" /></svg>);
export const IUsuarios = (p) => (<svg {...base} {...p}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14a6.5 6.5 0 0 1 3.5 6" /></svg>);
export const IEliminados = (p) => (<svg {...base} {...p}><path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13" /><path d="M10 11v5M14 11v5" /></svg>);
export const IMas = (p) => (<svg {...base} {...p}><circle cx="5" cy="12" r="1.4" /><circle cx="12" cy="12" r="1.4" /><circle cx="19" cy="12" r="1.4" /></svg>);
export const ISalir = (p) => (<svg {...base} {...p}><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 16l4-4-4-4M14 12H4" /></svg>);
export const IPlus = (p) => (<svg {...base} {...p}><path d="M12 5v14M5 12h14" /></svg>);
export const IChevron = (p) => (<svg {...base} {...p}><path d="M9 6l6 6-6 6" /></svg>);
