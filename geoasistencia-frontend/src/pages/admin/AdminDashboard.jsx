import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import AdminLayout from "./AdminLayout.jsx";
import { reportesApi } from "../../api/reportes.api";
import { usuariosApi } from "../../api/usuarios.api";

// Config puntualidad (frontend)
const HORA_ENTRADA_REF = "08:30"; // HH:mm
const TOLERANCIA_MIN = 10;

function fmtDateISO(d) {
  return d.toISOString().split("T")[0];
}
function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}
function toMinutes(hhmm) {
  if (!hhmm || typeof hhmm !== "string" || !hhmm.includes(":")) return 0;
  const [h, m] = hhmm.split(":").map((x) => Number(x));
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
}
function minutesOfDayFromISO(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.getHours() * 60 + d.getMinutes();
}

function Kpi({ label, value, hint, loading }) {
  return (
    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5">
      <div className="text-[10px] font-black text-gray-400 tracking-widest uppercase">
        {label}
      </div>
      <div className="text-3xl font-black mt-2 text-gray-900">
        {loading ? "…" : value}
      </div>
      {hint && <div className="text-xs text-gray-500 mt-1">{hint}</div>}
    </div>
  );
}

function QuickAction({ title, subtitle, onClick }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left p-4 rounded-2xl border border-gray-100 bg-white hover:bg-gray-50 transition flex items-start gap-3"
    >
      <div className="w-10 h-10 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center text-lg">
        →
      </div>
      <div>
        <div className="font-extrabold text-gray-900">{title}</div>
        <div className="text-xs text-gray-500 mt-0.5">{subtitle}</div>
      </div>
    </button>
  );
}

function MiniBarChart({ title, subtitle, data, loading }) {
  const max = Math.max(...(data?.map((d) => d.value) || [1]), 1);

  return (
    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 h-80">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="font-extrabold text-gray-900">{title}</div>
          <div className="text-xs text-gray-500 mt-1">{subtitle}</div>
        </div>
        <div className="text-xs text-gray-400">
          {loading ? "cargando…" : "7 días"}
        </div>
      </div>

      <div className="mt-6 h-44 flex items-end gap-2">
        {(loading ? Array.from({ length: 7 }).map((_, i) => ({ label: "—", value: 0, _k: i })) : data).map((d, idx) => {
          const h = loading ? 20 : Math.round((d.value / max) * 100);
          return (
            <div key={d._k ?? d.label ?? idx} className="flex-1 flex flex-col items-center gap-2">
              <div className="w-full rounded-2xl bg-slate-50 border border-slate-100 overflow-hidden h-40 flex items-end">
                <div
                  className="w-full bg-slate-900 rounded-2xl"
                  style={{ height: `${h}%` }}
                  title={`${d.label}: ${d.value}`}
                />
              </div>
              <div className="text-[10px] text-gray-400 font-bold">
                {loading ? "—" : d.label}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-5 flex items-center justify-between text-xs text-gray-500">
        <div className="flex items-center gap-2">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-slate-900" />
          Entradas (por día)
        </div>
        <div className="text-gray-400">Fuente: reportes/asistencia</div>
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const nav = useNavigate();

  const [loading, setLoading] = useState(true);

  const [kpi, setKpi] = useState({
    asistenciasHoy: 0,
    puntualidadPct: 0,
    fueraGeocerca: null,
    usuariosActivos: 0,
  });

  // Siempre 7 barras (aunque estén en 0)
  const [chart7d, setChart7d] = useState([
    { label: "Lun", value: 0 },
    { label: "Mar", value: 0 },
    { label: "Mié", value: 0 },
    { label: "Jue", value: 0 },
    { label: "Vie", value: 0 },
    { label: "Sáb", value: 0 },
    { label: "Dom", value: 0 },
  ]);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      try {
        const today = new Date();

        // ✅ Buffer: -1 día a +1 día (evita el “tengo que poner del 3 al 5”)
        const fechaDesdeHoy = fmtDateISO(addDays(today, -1));
        const fechaHastaHoy = fmtDateISO(addDays(today, +1));

        // ✅ Últimos 7 días con buffer al final (+1)
        const fechaDesde7 = fmtDateISO(addDays(today, -7));
        const fechaHasta7 = fmtDateISO(addDays(today, +1));

        // 1) Usuarios
        const usersPromise = usuariosApi.list();

        // 2) Reporte “hoy” (con buffer)
        const repHoyPromise = reportesApi.getAsistencia({
          fechaDesde: fechaDesdeHoy,
          fechaHasta: fechaHastaHoy,
          id_sede: "all",
          id_usuario: "all",
        });

        // 3) Reporte 7 días (con buffer)
        const rep7Promise = reportesApi.getAsistencia({
          fechaDesde: fechaDesde7,
          fechaHasta: fechaHasta7,
          id_sede: "all",
          id_usuario: "all",
        });

        const [uRes, repHoyRes, rep7Res] = await Promise.all([
          usersPromise,
          repHoyPromise,
          rep7Promise,
        ]);

        const totalUsuarios = uRes?.data?.usuarios?.length ?? 0;

        // Asistencias hoy (depende de kpis.total del backend)
        const hoyTotal =
          repHoyRes?.data?.kpis?.total ??
          (repHoyRes?.data?.resultados?.length || 0);

        // Datos 7 días
        const r7 = rep7Res?.data?.resultados || [];

        // Puntualidad
        const ref = toMinutes(HORA_ENTRADA_REF) + TOLERANCIA_MIN;
        let nEntradas = 0;
        let puntuales = 0;

        // Fuera geocerca (solo si existe campo)
        let fuera = 0;
        let hayCampoGeocerca = false;

        // Conteo por fecha
        const byDate = new Map(); // yyyy-mm-dd -> count

        for (const row of r7) {
          // `fecha` viene como "YYYY-MM-DD" en tu reporte de asistencia
          const fecha = row.fecha || null;
          if (fecha) byDate.set(fecha, (byDate.get(fecha) || 0) + 1);

          if (row.entrada) {
            const m = minutesOfDayFromISO(row.entrada);
            if (m !== null) {
              nEntradas += 1;
              if (m <= ref) puntuales += 1;
            }
          }

          if (row.fuera_geocerca === true) {
            hayCampoGeocerca = true;
            fuera += 1;
          } else if (typeof row.geocerca_ok === "boolean") {
            hayCampoGeocerca = true;
            if (!row.geocerca_ok) fuera += 1;
          } else if (typeof row.gps === "string") {
            hayCampoGeocerca = true;
            if (row.gps.toLowerCase().includes("fuera")) fuera += 1;
          } else if (typeof row.gps_estado === "string") {
            hayCampoGeocerca = true;
            if (row.gps_estado.toLowerCase().includes("fuera")) fuera += 1;
          }
        }

        const puntualidadPct = nEntradas
          ? Math.round((puntuales / nEntradas) * 100)
          : 0;

        // Labels de 7 días (Lun..Dom según la semana actual)
        const labels = [];
        for (let i = 6; i >= 0; i--) {
          const d = addDays(today, -i);
          const iso = fmtDateISO(d);
          const dayLabel = d
            .toLocaleDateString("es-EC", { weekday: "short" })
            .replace(".", "");
          labels.push({
            iso,
            label: dayLabel[0].toUpperCase() + dayLabel.slice(1),
          });
        }

        // ✅ SIEMPRE 7 barras, aunque value = 0
        const chart = labels.map((x) => ({
          label: x.label,
          value: byDate.get(x.iso) || 0,
        }));

        setKpi({
          asistenciasHoy: hoyTotal,
          puntualidadPct,
          fueraGeocerca: hayCampoGeocerca ? fuera : null,
          usuariosActivos: totalUsuarios,
        });

        setChart7d(chart);
      } catch (e) {
        console.error("Dashboard error:", e);

        // fallback: mantener 7 barras en 0
        setChart7d([
          { label: "Lun", value: 0 },
          { label: "Mar", value: 0 },
          { label: "Mié", value: 0 },
          { label: "Jue", value: 0 },
          { label: "Vie", value: 0 },
          { label: "Sáb", value: 0 },
          { label: "Dom", value: 0 },
        ]);
      } finally {
        setLoading(false);
      }
    };

    run();
  }, []);

  return (
    <AdminLayout title="Dashboard" subtitle="Resumen general de asistencias y actividad">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Kpi
          label="Asistencias hoy"
          value={kpi.asistenciasHoy}
          loading={loading}
          hint="Jornadas del día (rango ampliado ±1)"
        />
        <Kpi
          label="Puntualidad"
          value={`${kpi.puntualidadPct}%`}
          loading={loading}
          hint="08:30 + 10 min (últimos 7 días)"
        />
        <Kpi
          label="Fuera de geocerca"
          value={kpi.fueraGeocerca === null ? "—" : kpi.fueraGeocerca}
          loading={loading}
          hint={kpi.fueraGeocerca === null ? "No disponible en reportes" : "Según campo disponible"}
        />
        <Kpi
          label="Usuarios activos"
          value={kpi.usuariosActivos}
          loading={loading}
          hint="Total usuarios registrados"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        <div className="lg:col-span-2">
          <MiniBarChart
            title="Asistencias últimos 7 días"
            subtitle="Conteo de jornadas por día"
            data={chart7d}
            loading={loading}
          />
        </div>

        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
          <div className="font-extrabold text-gray-900">Acciones rápidas</div>
          <div className="text-xs text-gray-500 mt-1">Atajos a módulos principales</div>

          <div className="mt-4 space-y-3">
            <QuickAction
              title="Gestionar sedes"
              subtitle="Crear/editar sedes"
              onClick={() => nav("/sedes")}
            />
            <QuickAction
              title="Gestionar usuarios"
              subtitle="Crear/editar empleados"
              onClick={() => nav("/usuarios")}
            />
            <QuickAction
              title="Ver reportes"
              subtitle="Análisis y exportación"
              onClick={() => nav("/reportes")}
            />
          </div>

          <div className="mt-5 text-xs text-gray-400">
            Datos del dashboard se calculan con reportes + usuarios (sin cambiar backend).
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
