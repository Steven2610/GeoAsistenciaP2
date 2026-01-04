import { useMemo, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.jsx";
import { authApi } from "../api/auth.api.js";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const { login } = useAuth();
  const navigate = useNavigate();

  const emailOk = useMemo(() => EMAIL_REGEX.test(email.trim()), [email]);

  async function doLogin(e) {
    e.preventDefault();
    setError("");

    const cleanEmail = email.trim().toLowerCase();

    if (!EMAIL_REGEX.test(cleanEmail)) {
      setError("Ingresa un correo válido. Ej: nombre@dominio.com");
      return;
    }
    if (!password || password.trim().length < 4) {
      setError("La contraseña es obligatoria.");
      return;
    }

    setLoading(true);
    try {
      const data = await authApi.login({ email: cleanEmail, password });

      if (!data?.ok) {
        throw new Error(data?.message || "Credenciales inválidas");
      }

      login(data.token, data.user);

      // ✅ Redirección por rol (sin cambiar backend)
      if (data.user?.rol === "admin") navigate("/dashboard");
      else navigate("/m/asistencia");
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Error conectando con el servidor"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-md">
        {/* Card */}
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
          {/* Header */}
          <div className="p-7 border-b bg-white">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-black">
                G
              </div>
              <div>
                <h1 className="text-xl font-black text-gray-900 leading-tight">
                  GeoAsistencia
                </h1>
                <p className="text-xs text-gray-500">
                  Inicia sesión para continuar
                </p>
              </div>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={doLogin} className="p-7 space-y-5">
            {/* Error */}
            {error && (
              <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                <b>Oops:</b> {error}
              </div>
            )}

            {/* Email */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-black tracking-widest uppercase text-gray-400">
                Correo
              </label>
              <div className={`rounded-2xl border bg-white px-3 py-2.5 flex items-center gap-2
                ${email.length === 0 ? "border-gray-200" : emailOk ? "border-emerald-200" : "border-rose-200"}`}>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  className="w-full outline-none text-sm text-gray-900 placeholder:text-gray-400"
                  placeholder="tu@correo.com"
                  autoComplete="email"
                  required
                />
                {email.length > 0 && (
                  <span
                    className={`text-xs font-bold px-2 py-1 rounded-lg border
                      ${emailOk ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-rose-50 text-rose-700 border-rose-100"}`}
                  >
                    {emailOk ? "OK" : "INVÁLIDO"}
                  </span>
                )}
              </div>
              {!emailOk && email.length > 0 && (
                <p className="text-xs text-rose-600">
                  Debe contener <b>@</b> y un dominio válido (ej: .com)
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
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type="password"
                  className="w-full outline-none text-sm text-gray-900 placeholder:text-gray-400"
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                />
              </div>
            </div>

            {/* Submit */}
            <button
              disabled={loading || !emailOk}
              className="w-full h-11 rounded-2xl bg-slate-900 text-white font-extrabold text-sm hover:bg-slate-800 transition disabled:opacity-60 disabled:hover:bg-slate-900"
            >
              {loading ? "Ingresando..." : "Entrar"}
            </button>

            {/* Footer links */}
            <div className="flex items-center justify-between pt-1">
              <Link
                to="/register-empleado"
                className="text-sm font-bold text-slate-900 hover:underline"
              >
                Registrar empleado
              </Link>

              <span className="text-xs text-gray-400">
                ¿Problemas? Contacta al admin
              </span>
            </div>
          </form>
        </div>

        {/* Small note */}
        <div className="text-center text-xs text-gray-400 mt-4">
          © {new Date().getFullYear()} GeoAsistencia
        </div>
      </div>
    </div>
  );
}
