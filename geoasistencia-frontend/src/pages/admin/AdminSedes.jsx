import { useEffect, useMemo, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Circle,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import AdminLayout from "./AdminLayout.jsx";
import { sedesApi } from "../../api/sedes.api";

const customIcon = new L.Icon({
  iconUrl: "https://cdn-icons-png.flaticon.com/512/684/684908.png",
  iconSize: [36, 36],
  iconAnchor: [18, 36],
});

function MapResizer() {
  const map = useMap();
  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 250);
    return () => clearTimeout(t);
  }, [map]);
  return null;
}

function MapClickHandler({ onPick }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function ChangeView({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center && Array.isArray(center)) map.flyTo(center, 17, { duration: 1.2 });
  }, [center, map]);
  return null;
}

export default function AdminSedes() {
  const [sedes, setSedes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState("create");
  const [editing, setEditing] = useState(null);

  const DEFAULT_LAT = "-2.19616";
  const DEFAULT_LNG = "-79.88621";

  const [form, setForm] = useState({
    nombre: "",
    direccion: "",
    latitud: DEFAULT_LAT,
    longitud: DEFAULT_LNG,
    radio_metros: 100,
  });

  const loadSedes = async () => {
    setLoading(true);
    try {
      const { data } = await sedesApi.list();
      setSedes(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      alert(e?.response?.data?.message || "Hubo un error al cargar sedes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSedes();
  }, []);

  const stats = useMemo(() => {
    const totalSedes = sedes.length;

    // ✅ CAMBIO: ahora sumamos los presentes hoy (en vez de total_empleados)
    const totalEmp = sedes.reduce(
      (acc, s) => acc + (Number(s.presentes_hoy) || 0),
      0
    );

    const radioProm =
      totalSedes > 0
        ? Math.round(
            sedes.reduce((acc, s) => acc + (Number(s.radio_metros) || 0), 0) /
              totalSedes
          )
        : 0;

    return { totalSedes, totalEmp, radioProm };
  }, [sedes]);

  const handleOpenCreate = () => {
    setMode("create");
    setEditing(null);
    setForm({
      nombre: "",
      direccion: "",
      latitud: DEFAULT_LAT,
      longitud: DEFAULT_LNG,
      radio_metros: 100,
    });
    setOpen(true);
  };

  const handleOpenEdit = (sede) => {
    setMode("edit");
    setEditing(sede);
    setForm({
      ...sede,
      latitud: String(sede.latitud ?? DEFAULT_LAT),
      longitud: String(sede.longitud ?? DEFAULT_LNG),
      radio_metros: sede.radio_metros ?? 100,
    });
    setOpen(true);
  };

  const handleSave = async () => {
    if (!form.nombre?.trim()) return alert("El nombre es obligatorio");

    const lat = Number(form.latitud);
    const lng = Number(form.longitud);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return alert("Latitud/Longitud inválidas");
    }

    try {
      const payload = {
        ...form,
        nombre: String(form.nombre).trim(),
        direccion: String(form.direccion ?? "").trim(),
        latitud: lat,
        longitud: lng,
        radio_metros: Number(form.radio_metros),
      };

      if (mode === "create") await sedesApi.create(payload);
      else await sedesApi.update(editing.id_sede, payload);

      setOpen(false);
      await loadSedes();
    } catch (e) {
      console.error(e);
      alert(e?.response?.data?.message || "Error al procesar");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("¿Estás seguro de eliminar esta sede?")) return;
    try {
      await sedesApi.remove(id);
      await loadSedes();
    } catch (e) {
      console.error(e);
      alert(e?.response?.data?.message || "Error al eliminar");
    }
  };

  /**
   * GPS mejorado:
   * - pide alta precisión
   * - no usa caché
   * - usa watchPosition unos segundos para afinar y luego se detiene
   */
  const obtenerUbicacionGps = () => {
    if (!navigator.geolocation) return alert("Tu navegador no soporta geolocalización");

    const options = {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0,
    };

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((prev) => ({
          ...prev,
          latitud: pos.coords.latitude.toFixed(7),
          longitud: pos.coords.longitude.toFixed(7),
        }));
      },
      () => {
        const watchId = navigator.geolocation.watchPosition(
          (pos) => {
            setForm((prev) => ({
              ...prev,
              latitud: pos.coords.latitude.toFixed(7),
              longitud: pos.coords.longitude.toFixed(7),
            }));
          },
          (err) => {
            console.warn(err);
            alert(
              "No se pudo obtener ubicación precisa. Revisa permisos de ubicación y/o selecciona el punto en el mapa."
            );
          },
          options
        );

        setTimeout(() => navigator.geolocation.clearWatch(watchId), 6000);
      },
      options
    );
  };

  const sedesFiltradas = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return sedes;
    return sedes.filter((x) =>
      String(x.nombre ?? "").toLowerCase().includes(s)
    );
  }, [sedes, q]);

  return (
    <AdminLayout title="Sedes">
      <div className="p-8 bg-[#f8fafc] min-h-screen">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 leading-tight">Sedes</h1>
            <p className="text-gray-500 text-sm font-medium">
              Gestión de perímetros de asistencia
            </p>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1">
              <input
                className="w-full md:w-80 rounded-xl border border-gray-200 bg-white pl-10 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
                placeholder="Buscar sedes..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              <span className="absolute left-3.5 top-3 text-gray-400 text-xs">
                🔍
              </span>
            </div>

            <button
              onClick={handleOpenCreate}
              className="bg-[#2563EB] text-white px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-blue-700 shadow-lg shadow-blue-100 transition-all"
            >
              + Nueva Sede
            </button>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          <KpiCard title="TOTAL SEDES" value={stats.totalSedes} icon="🏢" color="blue" />
          {/* ✅ CAMBIO: ahora esto es presentes hoy sumados */}
          <KpiCard title="PRESENTES HOY" value={stats.totalEmp} icon="👥" color="purple" />
          <KpiCard title="RADIO PROMEDIO" value={`${stats.radioProm}m`} icon="📍" color="red" />
        </div>

        {/* Cards */}
        {loading ? (
          <div className="text-center py-20 text-gray-400 font-medium animate-pulse text-sm uppercase tracking-widest">
            Cargando datos...
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
            {sedesFiltradas.map((s) => (
              <SedeCard
                key={s.id_sede}
                sede={s}
                onEdit={() => handleOpenEdit(s)}
                onRemove={() => handleDelete(s.id_sede)}
              />
            ))}
          </div>
        )}

        {/* Modal */}
        {open && (
          <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden border border-gray-200">
              <div className="p-8 border-b flex justify-between items-center bg-white">
                <h2 className="text-xl font-bold text-gray-800">
                  {mode === "create" ? "Configurar Nueva Sede" : "Editar Sede"}
                </h2>
                <button
                  onClick={() => setOpen(false)}
                  className="text-gray-400 hover:text-gray-900 text-xl font-light"
                >
                  ✕
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 p-10">
                <div className="space-y-6">
                  <Field label="Nombre Comercial">
                    <input
                      className="w-full border border-gray-200 rounded-2xl p-4 text-sm focus:border-blue-500 outline-none transition-all"
                      value={form.nombre}
                      onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                    />
                  </Field>

                  <Field label="Dirección Física">
                    <input
                      className="w-full border border-gray-200 rounded-2xl p-4 text-sm focus:border-blue-500 outline-none transition-all"
                      value={form.direccion}
                      onChange={(e) => setForm({ ...form, direccion: e.target.value })}
                    />
                  </Field>

                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Latitud">
                      <input
                        className="w-full border border-gray-200 rounded-2xl p-4 text-sm bg-gray-50 text-gray-500"
                        value={form.latitud}
                        readOnly
                      />
                    </Field>
                    <Field label="Longitud">
                      <input
                        className="w-full border border-gray-200 rounded-2xl p-4 text-sm bg-gray-50 text-gray-500"
                        value={form.longitud}
                        readOnly
                      />
                    </Field>
                  </div>

                  <Field label="Radio (Metros)">
                    <input
                      type="number"
                      className="w-full border border-gray-200 rounded-2xl p-4 text-sm focus:border-blue-500 outline-none"
                      value={form.radio_metros}
                      onChange={(e) => setForm({ ...form, radio_metros: e.target.value })}
                    />
                  </Field>

                  <button
                    type="button"
                    onClick={obtenerUbicacionGps}
                    className="w-full py-4 bg-gray-900 text-white rounded-2xl text-sm font-bold shadow-xl hover:bg-black transition-all"
                  >
                    📍 Obtener Ubicación GPS
                  </button>
                </div>

                <div className="h-[450px] rounded-[2rem] overflow-hidden border border-gray-100 shadow-inner bg-gray-50">
                  <MapContainer
                    center={[Number(form.latitud), Number(form.longitud)]}
                    zoom={16}
                    className="h-full w-full"
                  >
                    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                    <Marker position={[Number(form.latitud), Number(form.longitud)]} icon={customIcon} />
                    <Circle
                      center={[Number(form.latitud), Number(form.longitud)]}
                      radius={parseInt(form.radio_metros) || 0}
                      pathOptions={{
                        fillColor: "#2563EB",
                        color: "#2563EB",
                        weight: 1,
                        fillOpacity: 0.2,
                      }}
                    />

                    <MapClickHandler
                      onPick={(lat, lng) =>
                        setForm((f) => ({
                          ...f,
                          latitud: lat.toFixed(7),
                          longitud: lng.toFixed(7),
                        }))
                      }
                    />

                    <ChangeView center={[Number(form.latitud), Number(form.longitud)]} />
                    <MapResizer />
                  </MapContainer>
                </div>
              </div>

              <div className="p-8 border-t bg-gray-50 flex justify-end gap-4">
                <button
                  onClick={() => setOpen(false)}
                  className="px-6 py-2.5 text-sm font-bold text-gray-400 hover:text-gray-600"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSave}
                  className="px-10 py-3 bg-[#2563EB] text-white rounded-2xl text-sm font-bold shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all"
                >
                  Guardar Sede
                </button>
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
    purple: "text-purple-600 bg-purple-50",
    red: "text-red-600 bg-red-50",
  };
  return (
    <div className="bg-white p-7 rounded-3xl border border-gray-100 shadow-sm flex items-center justify-between">
      <div>
        <p className="text-[10px] font-extrabold text-gray-400 tracking-widest uppercase mb-1">
          {title}
        </p>
        <p className="text-3xl font-bold text-gray-900">{value}</p>
      </div>
      <div className={`w-14 h-14 flex items-center justify-center rounded-2xl text-2xl ${styles[color]}`}>
        {icon}
      </div>
    </div>
  );
}

function SedeCard({ sede, onEdit, onRemove }) {
  const position = [Number(sede.latitud), Number(sede.longitud)];

  return (
    <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm hover:shadow-2xl transition-all duration-500 flex flex-col p-3">
      <div className="px-5 pt-5 pb-4">
        <h3 className="font-extrabold text-gray-900 text-xl tracking-tight truncate mb-1">
          {sede.nombre}
        </h3>
        <div className="flex items-center gap-2 text-gray-400">
          <span className="text-blue-500">📍</span>
          <span className="text-sm font-medium truncate italic">
            {sede.direccion || "Sin dirección registrada"}
          </span>
        </div>
      </div>

      <div className="mx-2 h-64 relative rounded-[2rem] overflow-hidden border border-gray-50 shadow-inner">
        <MapContainer
          center={position}
          zoom={15}
          zoomControl={false}
          attributionControl={false}
          dragging={true}
          scrollWheelZoom={true}
          doubleClickZoom={true}
          className="h-full w-full z-0"
        >
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <Marker position={position} icon={customIcon} />
          <Circle
            center={position}
            radius={parseInt(sede.radio_metros) || 0}
            pathOptions={{ color: "#2563EB", weight: 2, fillOpacity: 0.15, dashArray: "5, 10" }}
          />
          <MapResizer />
        </MapContainer>
      </div>

      <div className="p-5">
        <div className="flex items-center justify-around bg-[#f8fafc] py-4 rounded-[1.5rem] border border-gray-100 mb-6">
          <div className="text-center">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Radio</p>
            <div className="flex items-center justify-center gap-1">
              <span className="text-blue-500 font-bold">{sede.radio_metros}</span>
              <span className="text-[10px] text-gray-500 font-medium">mts</span>
            </div>
          </div>

          <div className="h-8 w-[1px] bg-gray-200"></div>

          <div className="text-center">
            {/* ✅ CAMBIO: presentes hoy */}
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Presentes</p>
            <div className="flex items-center justify-center gap-1">
              <span className="text-gray-800 font-bold">{sede.presentes_hoy ?? 0}</span>
              <span className="text-[10px] text-gray-500 font-medium">pers.</span>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onEdit}
            className="flex-1 bg-[#2563EB] text-white py-4 rounded-2xl text-xs font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 active:scale-95"
          >
            Ver detalles
          </button>

          <button
            onClick={onRemove}
            className="w-14 h-14 border border-gray-100 text-gray-400 rounded-2xl hover:bg-red-50 hover:text-red-500 transition-all flex items-center justify-center"
            title="Eliminar sede"
          >
            <span className="text-xl">🗑️</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest ml-1">
        {label}
      </label>
      {children}
    </div>
  );
}
