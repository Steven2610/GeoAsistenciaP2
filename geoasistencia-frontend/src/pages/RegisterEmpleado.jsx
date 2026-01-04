import { useMemo, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { authApi } from "../api/auth.api.js";
import { useAuth } from "../auth/AuthContext.jsx";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;

function cedulaFormatoOK(cedula) {
  if (!cedula) return true; // opcional
  const c = cedula.trim();
  return /^\d{10}$/.test(c);
}

function toISODateTimeOrUndefined(dateStr) {
  if (!dateStr) return undefined;
  // Convierte "YYYY-MM-DD" => ISO DateTime válido
  try {
    return new Date(`${dateStr}T00:00:00.000Z`).toISOString();
  } catch {
    return undefined;
  }
}

export default function RegisterEmpleado() {
  const [form, setForm] = useState({
    public_id: "",
    email: "",
    password: "",
    password2: "",
    nombres: "",
    apellidos: "",
    cedula: "",
    telefono: "",
    fecha_nacimiento: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const nav = useNavigate();
  const { login } = useAuth();

  const emailOk = useMemo(() => EMAIL_REGEX.test(form.email.trim()), [form.email]);
  const passOk = useMemo(() => (form.password || "").length >= 6, [form.password]);
  const passMatch = useMemo(
    () => form.password && form.password2 && form.password === form.password2,
    [form.password, form.password2]
  );
  const cedulaOk = useMemo(() => cedulaFormatoOK(form.cedula), [form.cedula]);

  const handleChange = (e) =>
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  async function onSubmit(e) {
    e.preventDefault();
    setError("");

    // Validaciones (sin detalles técnicos)
    const public_id = form.public_id.trim();
    const nombres = form.nombres.trim();
    const apellidos = form.apellidos.trim();
    const email = form.email.trim().toLowerCase();

    if (!public_id || public_id.length < 3) {
      setError("Verifica el ID del empleado.");
      return;
    }
    if (!nombres || nombres.length < 2) {
      setError("Verifica los nombres.");
      return;
    }
    if (!apellidos || apellidos.length < 2) {
      setError("Verifica los apellidos.");
      return;
    }
    if (!EMAIL_REGEX.test(email)) {
      setError("Verifica el correo ingresado.");
      return;
    }
    if ((form.password || "").length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    if (form.password !== form.password2) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    if (!cedulaOk) {
      setError("La cédula debe tener 10 dígitos.");
      return;
    }

    const payload = {
      public_id,
      email,
      password: form.password,
      nombres,
      apellidos,
      identidad: {
        cedula: form.cedula?.trim() || undefined,
        telefono: form.telefono?.trim() || undefined,
        // ✅ FIX: DateTime ISO válido
        fecha_nacimiento: toISODateTimeOrUndefined(form.fecha_nacimiento),
      },
    };

    setLoading(true);
    try {
      const data = await authApi.registerEmpleado(payload);

      if (!data?.ok) {
        setError("No se pudo completar el registro.");
        return;
      }

      login(data.token, data.user);
      nav("/m/asistencia");
    } catch (_err) {
      // ✅ Mensaje genérico (sin exponer detalles)
      setError("No se pudo registrar. Inténtalo nuevamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
          {/* Header */}
          <div className="p-7 border-b bg-white">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-black">
                +
              </div>
              <div>
                <h1 className="text-xl font-black text-gray-900 leading-tight">
                  Registrar empleado
                </h1>
                <p className="text-xs text-gray-500">
                  Completa tus datos para crear la cuenta
                </p>
              </div>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={onSubmit} className="p-7 space-y-5">
            {/* Error */}
            {error && (
              <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {error}
              </div>
            )}

            {/* ID */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-black tracking-widest uppercase text-gray-400">
                ID de empleado
              </label>
              <div className="rounded-2xl border border-gray-200 bg-white px-3 py-2.5">
                <input
                  name="public_id"
                  value={form.public_id}
                  onChange={handleChange}
                  placeholder="Ej: EMP-102"
                  className="w-full outline-none text-sm text-gray-900 placeholder:text-gray-400"
                  autoComplete="off"
                  required
                />
              </div>
              <p className="text-xs text-gray-400">
                Este código se usará para identificarte en listados.
              </p>
            </div>

            {/* Nombres / Apellidos */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[11px] font-black tracking-widest uppercase text-gray-400">
                  Nombres
                </label>
                <div className="rounded-2xl border border-gray-200 bg-white px-3 py-2.5">
                  <input
                    name="nombres"
                    value={form.nombres}
                    onChange={handleChange}
                    placeholder="Juan"
                    className="w-full outline-none text-sm text-gray-900 placeholder:text-gray-400"
                    autoComplete="given-name"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-black tracking-widest uppercase text-gray-400">
                  Apellidos
                </label>
                <div className="rounded-2xl border border-gray-200 bg-white px-3 py-2.5">
                  <input
                    name="apellidos"
                    value={form.apellidos}
                    onChange={handleChange}
                    placeholder="Pérez"
                    className="w-full outline-none text-sm text-gray-900 placeholder:text-gray-400"
                    autoComplete="family-name"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Datos personales */}
            <div className="pt-3 border-t border-gray-100">
              <div className="text-[10px] font-black tracking-widest uppercase text-gray-400 mb-3">
                Datos personales
              </div>

              {/* Cédula */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-black tracking-widest uppercase text-gray-400">
                  Cédula
                </label>
                <div
                  className={`rounded-2xl border bg-white px-3 py-2.5 ${
                    form.cedula.length === 0
                      ? "border-gray-200"
                      : cedulaOk
                      ? "border-emerald-200"
                      : "border-rose-200"
                  }`}
                >
                  <input
                    name="cedula"
                    value={form.cedula}
                    onChange={(e) => {
                      const v = e.target.value.replace(/[^\d]/g, "");
                      setForm((prev) => ({ ...prev, cedula: v }));
                    }}
                    placeholder="0102030405"
                    maxLength={10}
                    className="w-full outline-none text-sm text-gray-900 placeholder:text-gray-400"
                    autoComplete="off"
                  />
                </div>
                {form.cedula.length > 0 && !cedulaOk && (
                  <p className="text-xs text-rose-600">
                    Debe tener 10 dígitos.
                  </p>
                )}
              </div>

              {/* Teléfono */}
              <div className="space-y-1.5 mt-3">
                <label className="text-[11px] font-black tracking-widest uppercase text-gray-400">
                  Teléfono
                </label>
                <div className="rounded-2xl border border-gray-200 bg-white px-3 py-2.5">
                  <input
                    name="telefono"
                    value={form.telefono}
                    onChange={(e) => {
                      const v = e.target.value.replace(/[^\d+]/g, "");
                      setForm((prev) => ({ ...prev, telefono: v }));
                    }}
                    placeholder="09xxxxxxxx"
                    className="w-full outline-none text-sm text-gray-900 placeholder:text-gray-400"
                    autoComplete="tel"
                  />
                </div>
              </div>

              {/* Fecha nacimiento */}
              <div className="space-y-1.5 mt-3">
                <label className="text-[11px] font-black tracking-widest uppercase text-gray-400">
                  Fecha de nacimiento
                </label>
                <div className="rounded-2xl border border-gray-200 bg-white px-3 py-2.5">
                  <input
                    type="date"
                    name="fecha_nacimiento"
                    value={form.fecha_nacimiento}
                    onChange={handleChange}
                    className="w-full outline-none text-sm text-gray-900"
                    autoComplete="bday"
                  />
                </div>
              </div>
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-black tracking-widest uppercase text-gray-400">
                Correo
              </label>

              <div
                className={`rounded-2xl border bg-white px-3 py-2.5 flex items-center gap-2
                ${
                  form.email.length === 0
                    ? "border-gray-200"
                    : emailOk
                    ? "border-emerald-200"
                    : "border-rose-200"
                }`}
              >
                <input
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  type="email"
                  placeholder="nombre@correo.com"
                  className="w-full outline-none text-sm text-gray-900 placeholder:text-gray-400"
                  autoComplete="email"
                  required
                />
                {form.email.length > 0 && (
                  <span
                    className={`text-xs font-bold px-2 py-1 rounded-lg border
                      ${
                        emailOk
                          ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                          : "bg-rose-50 text-rose-700 border-rose-100"
                      }`}
                  >
                    {emailOk ? "OK" : "INVÁLIDO"}
                  </span>
                )}
              </div>

              {!emailOk && form.email.length > 0 && (
                <p className="text-xs text-rose-600">
                  Verifica el formato del correo.
                </p>
              )}
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-black tracking-widest uppercase text-gray-400">
                Contraseña
              </label>
              <div className="rounded-2xl border border-gray-200 bg-white px-3 py-2.5">
                <input
                  name="password"
                  value={form.password}
                  onChange={handleChange}
                  type="password"
                  placeholder="••••••••"
                  className="w-full outline-none text-sm text-gray-900 placeholder:text-gray-400"
                  autoComplete="new-password"
                  required
                />
              </div>
              <p className={`text-xs ${passOk ? "text-gray-400" : "text-rose-600"}`}>
                Mínimo 6 caracteres.
              </p>
            </div>

            {/* Confirm password */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-black tracking-widest uppercase text-gray-400">
                Confirmar contraseña
              </label>
              <div
                className={`rounded-2xl border bg-white px-3 py-2.5 ${
                  form.password2.length === 0
                    ? "border-gray-200"
                    : passMatch
                    ? "border-emerald-200"
                    : "border-rose-200"
                }`}
              >
                <input
                  name="password2"
                  value={form.password2}
                  onChange={handleChange}
                  type="password"
                  placeholder="••••••••"
                  className="w-full outline-none text-sm text-gray-900 placeholder:text-gray-400"
                  autoComplete="new-password"
                  required
                />
              </div>
              {form.password2.length > 0 && !passMatch && (
                <p className="text-xs text-rose-600">Las contraseñas no coinciden.</p>
              )}
            </div>

            {/* Submit */}
            <button
              disabled={loading || !emailOk || !passOk || !passMatch || !cedulaOk}
              className="w-full h-11 rounded-2xl bg-slate-900 text-white font-extrabold text-sm hover:bg-slate-800 transition disabled:opacity-60 disabled:hover:bg-slate-900"
            >
              {loading ? "Creando..." : "Crear cuenta"}
            </button>

            <div className="text-center pt-2">
              <p className="text-sm text-gray-500">
                ¿Ya tienes una cuenta?{" "}
                <Link to="/login" className="text-slate-900 font-bold hover:underline">
                  Inicia sesión
                </Link>
              </p>
            </div>
          </form>
        </div>

        <div className="text-center text-xs text-gray-400 mt-4">
          © {new Date().getFullYear()} GeoAsistencia
        </div>
      </div>
    </div>
  );
}
