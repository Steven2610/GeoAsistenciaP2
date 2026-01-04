import { useEffect, useMemo, useState } from "react";
import AdminLayout from "./AdminLayout.jsx";
import { usuariosApi } from "../../api/usuarios.api";
import { sedesApi } from "../../api/sedes.api";

export default function AdminUsuarios() {
    const [loading, setLoading] = useState(true);
    const [usuarios, setUsuarios] = useState([]);
    const [kpis, setKpis] = useState({
        totalUsuarios: 0,
        activosHoy: 0,
        totalAdmins: 0,
        totalEmpleados: 0,
    });

    const [sedes, setSedes] = useState([]);
    const [q, setQ] = useState("");
    const [rolFilter, setRolFilter] = useState("all");
    const [estadoFilter, setEstadoFilter] = useState("all");

    // modal create/edit
    const [open, setOpen] = useState(false);
    const [mode, setMode] = useState("create"); // create | edit
    const [editing, setEditing] = useState(null);

    const [form, setForm] = useState({
        public_id: "",
        email: "",
        password: "",
        rol: "empleado",
        estado: "activo",
        id_sede_asignada: "",

        nombres: "",
        apellidos: "",
        cedula: "",
        telefono: ""
    });

    // ✅ modal revelar identidad
    const [openIdentidad, setOpenIdentidad] = useState(false);
    const [identidadUser, setIdentidadUser] = useState(null);
    const [motivo, setMotivo] = useState("");
    const [revelando, setRevelando] = useState(false);

    async function loadAll() {
        setLoading(true);
        try {
            const [uRes, sRes] = await Promise.all([usuariosApi.list(), sedesApi.list()]);
            const uData = uRes.data;

            setUsuarios(uData.usuarios || []);
            setKpis(
                uData.kpis || {
                    totalUsuarios: 0,
                    activosHoy: 0,
                    totalAdmins: 0,
                    totalEmpleados: 0,
                }
            );

            const sedesData = sRes.data || [];
            setSedes(Array.isArray(sedesData) ? sedesData : []);
        } catch (e) {
            console.error(e);
            alert(e?.response?.data?.message || "Error al cargar usuarios");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        loadAll();
    }, []);

    const filtered = useMemo(() => {
        const s = q.trim().toLowerCase();
        return usuarios.filter((u) => {
            const matchQ =
                !s ||
                String(u.public_id || "").toLowerCase().includes(s) ||
                String(u.email || "").toLowerCase().includes(s);

            const matchRol = rolFilter === "all" ? true : String(u.rol) === rolFilter;
            const matchEstado = estadoFilter === "all" ? true : String(u.estado) === estadoFilter;

            return matchQ && matchRol && matchEstado;
        });
    }, [usuarios, q, rolFilter, estadoFilter]);

    function openCreate() {
        setMode("create");
        setEditing(null);
        setForm({
            public_id: "",
            email: "",
            password: "",
            rol: "empleado",
            estado: "activo",
            id_sede_asignada: "",
            nombres: "",
            apellidos: "",
            cedula: "",
            telefono: ""
        });
        setOpen(true);
    }

    function openEdit(u) {
        setMode("edit");
        setEditing(u);
        setForm({
            public_id: u.public_id || "",
            email: u.email || "",
            password: "",
            rol: u.rol || "empleado",
            estado: u.estado || "activo",
            id_sede_asignada: u.id_sede_asignada || "",
        });
        setOpen(true);
    }

    async function save() {
        try {
            if (!form.email?.trim()) return alert("Email requerido");
            if (mode === "create" && (!form.public_id?.trim() || !form.password?.trim())) {
                return alert("public_id y password requeridos");
            }

            const payload = {
                email: form.email.trim(),
                rol: form.rol,
                estado: form.estado,
                id_sede_asignada: form.id_sede_asignada || null,
                nombres: form.nombres.trim(),
                apellidos: form.apellidos.trim(),
                cedula: form.cedula.trim(),
                telefono: form.telefono.trim()
            };

            if (mode === "create") {
                await usuariosApi.create({
                    public_id: form.public_id.trim(),
                    password: form.password.trim(),
                    ...payload,
                });
            } else {
                await usuariosApi.update(editing.id_usuario, payload);
            }

            setOpen(false);
            await loadAll();
        } catch (e) {
            console.error(e);
            alert(e?.response?.data?.message || "No se pudo guardar");
        }
    }

    function openRevelarIdentidad(u) {
        setIdentidadUser(u);
        setMotivo("");
        setOpenIdentidad(true);
    }

    async function confirmarRevelar() {
        if (!identidadUser) return;
        if (!motivo.trim() || motivo.trim().length < 5) return alert("Debes escribir un motivo válido (mín. 5 caracteres).");

        setRevelando(true);
        try {
            const { data } = await usuariosApi.revelarIdentidad(identidadUser.id_usuario, {
                motivo: motivo.trim(),
            });

            setOpenIdentidad(false);

            if (data.ok && data.identidad) {
                const { nombres, apellidos, cedula, telefono } = data.identidad;
                const msg = `
IDENTIDAD REVELADA:
----------------------------------
Nombre: ${nombres} ${apellidos}
Cédula: ${cedula || 'N/A'}
Teléfono: ${telefono || 'N/A'}
----------------------------------
Esta acción ha sido registrada en auditoría.`;
                alert(msg);
            } else {
                alert("El usuario no tiene información de identidad registrada.");
            }
        } catch (e) {
            console.error(e);
            alert(e?.response?.data?.message || "No se pudo revelar identidad");
        } finally {
            setRevelando(false);
        }
    }

    return (
        <AdminLayout title="Usuarios">
            <div className="p-8 bg-[#f8fafc] min-h-screen">
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-8">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 leading-tight">Usuarios</h1>
                        <p className="text-gray-500 text-sm font-medium">Gestión de empleados y permisos</p>
                    </div>
                    <button
                        onClick={openCreate}
                        className="bg-[#2563EB] text-white px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-blue-700 shadow-lg shadow-blue-100 transition-all"
                    >
                        + Nuevo Usuario
                    </button>
                </div>

                {/* KPIs */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
                    <KpiCard title="TOTAL USUARIOS" value={kpis.totalUsuarios} icon="👤" color="blue" />
                    <KpiCard title="ACTIVOS HOY" value={kpis.activosHoy} icon="🟢" color="green" />
                    <KpiCard title="EMPLEADOS" value={kpis.totalEmpleados} icon="🧑‍💼" color="purple" />
                    <KpiCard title="ADMINS" value={kpis.totalAdmins} icon="🛡️" color="red" />
                </div>

                {/* Filtros */}
                <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5 mb-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="relative">
                            <input
                                className="w-full rounded-xl border border-gray-200 bg-white pl-10 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
                                placeholder="Buscar por ID o email..."
                                value={q}
                                onChange={(e) => setQ(e.target.value)}
                            />
                            <span className="absolute left-3.5 top-3 text-gray-400 text-xs">🔍</span>
                        </div>
                        <select
                            className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
                            value={rolFilter}
                            onChange={(e) => setRolFilter(e.target.value)}
                        >
                            <option value="all">Todos los roles</option>
                            <option value="admin">Admin</option>
                            <option value="empleado">Empleado</option>
                        </select>
                        <select
                            className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
                            value={estadoFilter}
                            onChange={(e) => setEstadoFilter(e.target.value)}
                        >
                            <option value="all">Todos los estados</option>
                            <option value="activo">Activo</option>
                            <option value="inactivo">Inactivo</option>
                        </select>
                    </div>
                </div>

                {/* Tabla */}
                <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b bg-gray-50 flex items-center justify-between">
                        <div className="text-[11px] font-black text-gray-400 uppercase tracking-widest">
                            Lista de usuarios
                        </div>
                        <div className="text-xs text-gray-400 font-semibold">{filtered.length} encontrados</div>
                    </div>

                    {loading ? (
                        <div className="text-center py-16 text-gray-400 font-medium animate-pulse text-sm uppercase tracking-widest">
                            Cargando...
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="text-[11px] uppercase tracking-widest text-gray-400 bg-white">
                                    <tr className="border-b">
                                        <th className="px-6 py-4 text-left">ID Público</th>
                                        <th className="px-6 py-4 text-left">Email</th>
                                        <th className="px-6 py-4 text-left">Rol</th>
                                        <th className="px-6 py-4 text-left">Sede</th>
                                        <th className="px-6 py-4 text-left">Estado</th>
                                        <th className="px-6 py-4 text-left">Última acción</th>
                                        <th className="px-6 py-4 text-right">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {filtered.map((u) => (
                                        <tr key={u.id_usuario} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-6 py-4 font-bold text-gray-900">{u.public_id}</td>
                                            <td className="px-6 py-4 text-gray-700">{u.email}</td>
                                            <td className="px-6 py-4"><RolePill rol={u.rol} /></td>
                                            <td className="px-6 py-4 text-gray-700">{u.sede_nombre}</td>
                                            <td className="px-6 py-4"><EstadoPill estado={u.estado} /></td>
                                            <td className="px-6 py-4">
                                                {u.ultima_accion_hoy ? (
                                                    <span className={u.ultima_accion_hoy === "ENTRADA" ? "text-emerald-700 bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-full text-xs font-bold" : "text-amber-700 bg-amber-50 border border-amber-100 px-2.5 py-1 rounded-full text-xs font-bold"}>
                                                        {u.ultima_accion_hoy}
                                                    </span>
                                                ) : <span className="text-gray-500 bg-gray-50 border border-gray-100 px-2.5 py-1 rounded-full text-xs font-bold">—</span>}
                                                {u.ultimo_registro_hoy && <div className="text-[11px] text-gray-400 mt-1">{new Date(u.ultimo_registro_hoy).toLocaleTimeString()}</div>}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex justify-end gap-2">
                                                    <button onClick={() => openRevelarIdentidad(u)} className="px-3 py-2 rounded-xl border border-gray-200 hover:bg-orange-50 text-xs font-bold" title="Revelar identidad">🪪</button>
                                                    <button onClick={() => openEdit(u)} className="px-3 py-2 rounded-xl border border-gray-200 hover:bg-gray-100 text-xs font-bold" title="Editar">✏️</button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Modal Crear/Editar */}
                {/* Modal Crear/Editar */}
                {open && (
                    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                        <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden border border-gray-200">
                            <div className="p-8 border-b flex justify-between items-center bg-white">
                                <h2 className="text-xl font-bold text-gray-800">
                                    {mode === "create" ? "Nuevo Usuario" : "Editar Usuario"}
                                </h2>
                                <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-900 text-xl font-light">✕</button>
                            </div>

                            <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-5 max-h-[70vh] overflow-y-auto">

                                {/* --- SECCIÓN 1: CREDENCIALES --- */}
                                <div className="col-span-full">
                                    <p className="text-[11px] font-black text-blue-500 uppercase tracking-widest mb-2">Credenciales de Acceso</p>
                                </div>

                                {mode === "create" && (
                                    <>
                                        <Field label="ID Público">
                                            <input className="w-full border border-gray-200 rounded-2xl p-4 text-sm outline-none focus:border-blue-500" value={form.public_id} onChange={(e) => setForm((f) => ({ ...f, public_id: e.target.value }))} placeholder="DOC-001" />
                                        </Field>
                                        <Field label="Password">
                                            <input type="password" className="w-full border border-gray-200 rounded-2xl p-4 text-sm outline-none focus:border-blue-500" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} placeholder="********" />
                                        </Field>
                                    </>
                                )}

                                <Field label="Email">
                                    <input className="w-full border border-gray-200 rounded-2xl p-4 text-sm outline-none focus:border-blue-500" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="correo@empresa.com" />
                                </Field>

                                <Field label="Rol">
                                    <select className="w-full border border-gray-200 rounded-2xl p-4 text-sm outline-none focus:border-blue-500 bg-white" value={form.rol} onChange={(e) => setForm((f) => ({ ...f, rol: e.target.value }))}>
                                        <option value="empleado">Empleado</option>
                                        <option value="admin">Admin</option>
                                    </select>
                                </Field>

                                <Field label="Sede asignada">
                                    <select className="w-full border border-gray-200 rounded-2xl p-4 text-sm outline-none focus:border-blue-500 bg-white" value={form.id_sede_asignada} onChange={(e) => setForm((f) => ({ ...f, id_sede_asignada: e.target.value }))}>
                                        <option value="">— Sin sede —</option>
                                        {sedes.map((s) => <option key={s.id_sede} value={s.id_sede}>{s.nombre}</option>)}
                                    </select>
                                </Field>

                                {/* --- SECCIÓN 2: INFORMACIÓN PERSONAL (NUEVA) --- */}
                                <div className="col-span-full border-t pt-6 mt-2">
                                    <p className="text-[11px] font-black text-blue-500 uppercase tracking-widest mb-2">Información Personal (Identidad)</p>
                                </div>

                                <Field label="Nombres *">
                                    <input className="w-full border border-gray-200 rounded-2xl p-4 text-sm outline-none focus:border-blue-500" value={form.nombres} onChange={(e) => setForm({ ...form, nombres: e.target.value })} placeholder="Ej: Juan Andrés" />
                                </Field>

                                <Field label="Apellidos *">
                                    <input className="w-full border border-gray-200 rounded-2xl p-4 text-sm outline-none focus:border-blue-500" value={form.apellidos} onChange={(e) => setForm({ ...form, apellidos: e.target.value })} placeholder="Ej: Pérez Castro" />
                                </Field>

                                <Field label="Cédula / DNI">
                                    <input className="w-full border border-gray-200 rounded-2xl p-4 text-sm outline-none focus:border-blue-500" value={form.cedula} onChange={(e) => setForm({ ...form, cedula: e.target.value })} placeholder="09XXXXXXXX" />
                                </Field>

                                <Field label="Teléfono">
                                    <input className="w-full border border-gray-200 rounded-2xl p-4 text-sm outline-none focus:border-blue-500" value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} placeholder="099XXXXXXX" />
                                </Field>
                            </div>

                            <div className="p-8 border-t bg-gray-50 flex justify-end gap-4">
                                <button onClick={() => setOpen(false)} className="px-6 py-2.5 text-sm font-bold text-gray-400 hover:text-gray-600">Cancelar</button>
                                <button onClick={save} className="px-10 py-3 bg-[#2563EB] text-white rounded-2xl text-sm font-bold shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all">Guardar Usuario</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Modal Revelar Identidad */}
                {openIdentidad && (
                    <div className="fixed inset-0 z-[2100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                        <div className="bg-white w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden border border-gray-200">
                            <div className="p-6 bg-gradient-to-r from-orange-500 to-red-500 text-white">
                                <div className="text-lg font-extrabold">Revelar Identidad</div>
                                <div className="text-xs opacity-90">Acción auditada y registrada</div>
                            </div>
                            <div className="p-6">
                                <div className="rounded-2xl border border-orange-100 bg-orange-50 p-4 mb-4">
                                    <div className="font-bold text-orange-800 text-sm">⚠️ Advertencia de seguridad</div>
                                    <div className="text-xs text-orange-700 mt-1">Esta acción revelará información personal protegida y quedará registrada en auditoría.</div>
                                </div>
                                <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 mb-4">
                                    <div className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-2">Usuario seleccionado</div>
                                    <div className="font-extrabold text-gray-900">{identidadUser?.public_id}</div>
                                    <div className="text-sm text-gray-600">{identidadUser?.email}</div>
                                </div>
                                <div className="mb-2">
                                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest ml-1">Motivo de la consulta <span className="text-red-500">*</span></label>
                                    <textarea className="w-full mt-2 border border-gray-200 rounded-2xl p-4 text-sm outline-none focus:ring-2 focus:ring-orange-400" placeholder="Describe el motivo..." value={motivo} onChange={(e) => setMotivo(e.target.value.slice(0, 500))} rows={4} />
                                    <div className="text-xs text-gray-400 mt-1">{motivo.length}/500 caracteres</div>
                                </div>
                                <div className="mt-5 flex gap-3 justify-end">
                                    <button onClick={() => setOpenIdentidad(false)} className="px-6 py-3 rounded-2xl border border-gray-200 text-sm font-bold hover:bg-gray-50" disabled={revelando}>Cancelar</button>
                                    <button onClick={confirmarRevelar} className="px-6 py-3 rounded-2xl text-sm font-extrabold text-white bg-gradient-to-r from-orange-500 to-red-500 hover:opacity-95 disabled:opacity-60" disabled={revelando}>{revelando ? "Revelando..." : "Confirmar y revelar"}</button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </AdminLayout>
    );
}

function KpiCard({ title, value, icon, color }) {
    const styles = {
        blue: "text-blue-600 bg-blue-50",
        green: "text-emerald-600 bg-emerald-50",
        purple: "text-purple-600 bg-purple-50",
        red: "text-red-600 bg-red-50",
    };
    return (
        <div className="bg-white p-7 rounded-3xl border border-gray-100 shadow-sm flex items-center justify-between">
            <div>
                <p className="text-[10px] font-extrabold text-gray-400 tracking-widest uppercase mb-1">{title}</p>
                <p className="text-3xl font-bold text-gray-900">{value}</p>
            </div>
            <div className={`w-14 h-14 flex items-center justify-center rounded-2xl text-2xl ${styles[color]}`}>{icon}</div>
        </div>
    );
}

function RolePill({ rol }) {
    const isAdmin = String(rol) === "admin";
    return (
        <span className={isAdmin ? "text-red-700 bg-red-50 border border-red-100 px-2.5 py-1 rounded-full text-xs font-bold" : "text-blue-700 bg-blue-50 border border-blue-100 px-2.5 py-1 rounded-full text-xs font-bold"}>
            {isAdmin ? "Admin" : "Empleado"}
        </span>
    );
}

function EstadoPill({ estado }) {
    const isActivo = String(estado) === "activo";
    return (
        <span className={isActivo ? "text-emerald-700 bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-full text-xs font-bold" : "text-gray-700 bg-gray-50 border border-gray-100 px-2.5 py-1 rounded-full text-xs font-bold"}>
            {isActivo ? "Activo" : "Inactivo"}
        </span>
    );
}

function Field({ label, children }) {
    return (
        <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest ml-1">{label}</label>
            {children}
        </div>
    );
}