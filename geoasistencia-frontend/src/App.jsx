// src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Login from "./pages/Login.jsx";
import RegisterEmpleado from "./pages/RegisterEmpleado.jsx";
import AdminDashboard from "./pages/admin/AdminDashboard.jsx";
import AdminSedes from "./pages/admin/AdminSedes.jsx";
import AdminUsuarios from "./pages/admin/AdminUsuarios.jsx"; // ✅ NUEVO
import AsistenciaMovil from "./pages/employee/AsistenciaMovil.jsx";
import AdminReportes from "./pages/admin/AdminReportes.jsx";

import { AuthProvider, useAuth } from "./auth/AuthContext.jsx";

/* =========================
   RUTAS PRIVADAS (ROBUSTAS)
========================= */

function readLSUser() {
  try {
    return JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    return null;
  }
}

function PrivateAdminRoute({ children }) {
  const { token, user } = useAuth();

  const tokenOk = token || localStorage.getItem("token");
  const userOk = user || readLSUser();
  const rol = String(userOk?.rol || userOk?.role || "").toLowerCase();

  if (!tokenOk) return <Navigate to="/login" replace />;
  if (rol !== "admin") return <Navigate to="/login" replace />;

  return children;
}

function PrivateEmpleadoRoute({ children }) {
  const { token, user } = useAuth();

  const tokenOk = token || localStorage.getItem("token");
  const userOk = user || readLSUser();
  const rol = String(userOk?.rol || userOk?.role || "").toLowerCase();

  if (!tokenOk) return <Navigate to="/login" replace />;
  if (rol !== "empleado") return <Navigate to="/login" replace />;

  return children;
}

/* =========================
   APP
========================= */

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* RUTAS PÚBLICAS */}
          <Route path="/login" element={<Login />} />
          <Route path="/register-empleado" element={<RegisterEmpleado />} />

          {/* ================= ADMIN (WEB) ================= */}
          <Route
            path="/dashboard"
            element={
              <PrivateAdminRoute>
                <AdminDashboard />
              </PrivateAdminRoute>
            }
          />

          <Route
            path="/sedes"
            element={
              <PrivateAdminRoute>
                <AdminSedes />
              </PrivateAdminRoute>
            }
          />

          {/* ✅ USUARIOS (ADMIN) */}
          <Route
            path="/usuarios"
            element={
              <PrivateAdminRoute>
                <AdminUsuarios />
              </PrivateAdminRoute>
            }
          />
          <Route
            path="/reportes"
            element={
              <PrivateAdminRoute>
                <AdminReportes />
              </PrivateAdminRoute>
            }
          />

          {/* ================= EMPLEADO (MÓVIL) ================= */}
          <Route
            path="/m/asistencia"
            element={
              <PrivateEmpleadoRoute>
                <AsistenciaMovil />
              </PrivateEmpleadoRoute>
            }
          />

          {/* ================= DEFAULT ================= */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
