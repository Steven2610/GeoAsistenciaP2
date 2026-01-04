import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext.jsx";

// Item de menú limpio y profesional con iconos minimalistas
const Item = ({ to, children, icon }) => (
  <NavLink
    to={to}
    className={({ isActive }) =>
      `flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
        isActive 
          ? "bg-slate-900 text-white shadow-lg shadow-slate-200" 
          : "text-slate-600 hover:bg-slate-100"
      }`
    }
  >
    <span className="text-base">{icon}</span>
    {children}
  </NavLink>
);

export default function AdminLayout({ title, subtitle, children }) {
  const { user, logout } = useAuth();
  const nav = useNavigate();

  function handleLogout() {
    logout();
    nav("/login");
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <div className="flex">
        {/* --- SIDEBAR IZQUIERDO --- */}
        <aside className="w-64 bg-white border-r min-h-screen px-5 py-8 flex flex-col fixed">
          {/* Logo Corporativo */}
          <div className="flex items-center gap-3 mb-10 px-2">
            <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center shadow-sm">
              <span className="text-white font-bold text-lg">G</span>
            </div>
            <div>
              <div className="font-bold text-slate-900 leading-tight">GeoAsistencia</div>
              <div className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Corporativo</div>
            </div>
          </div>

          {/* Navegación Refinada */}
          <nav className="space-y-1.5 flex-1">
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 px-2">Menú</div>
            <Item to="/dashboard" icon="🏠">Inicio</Item>
            <Item to="/sedes" icon="🏢">Sedes</Item>
            <Item to="/usuarios" icon="👥">Usuarios</Item>
            <Item to="/reportes" icon="📊">Reportes</Item>
          </nav>

          {/* Botón Salida */}
          <div className="mt-auto pt-6 border-t border-slate-100">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all"
            >
              <span>🚪</span> Cerrar sesión
            </button>
          </div>
        </aside>

        {/* --- CONTENIDO PRINCIPAL --- */}
        <main className="flex-1 ml-64">
          {/* Topbar Superior */}
          <header className="bg-white/80 backdrop-blur-md border-b px-10 py-4 flex items-center justify-between sticky top-0 z-40">
            <div className="max-w-md w-full">
              <div className="relative">
                <input
                  className="w-full border border-slate-200 rounded-xl px-4 py-2 text-xs bg-slate-50 focus:ring-2 focus:ring-slate-900 outline-none transition-all"
                  placeholder="Buscar en el sistema..."
                />
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-right hidden sm:block">
                <div className="text-xs font-black text-slate-900 uppercase">{user?.email?.split('@')[0]}</div>
                <div className="text-[10px] text-slate-400 font-bold">Administrador</div>
              </div>
              <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-slate-700 shadow-sm">
                {user?.email?.[0]?.toUpperCase() || "A"}
              </div>
            </div>
          </header>

          {/* Área de Trabajo - Máximo Espacio */}
          <div className="px-12 py-10 max-w-[1600px] mx-auto">
            {(title || subtitle) && (
              <div className="mb-10">
                <h1 className="text-4xl font-black text-slate-900 tracking-tight mb-2">{title}</h1>
                {subtitle && <p className="text-slate-500 font-medium text-lg">{subtitle}</p>}
              </div>
            )}

            {/* Renderizado de las páginas de reportes/usuarios */}
            <div className="min-h-screen">
                {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}