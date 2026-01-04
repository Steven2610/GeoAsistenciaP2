import { useEffect, useMemo, useRef, useState } from "react";
import { sedesApi } from "../../api/sedes.api";
import { asistenciaApi } from "../../api/asistencia.api";
import { useAuth } from "../../auth/AuthContext.jsx";
import MapPicker from "../../components/MapPicker";

/* =========================
   UTILIDADES
========================= */
function haversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (v) => (v * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function fmtHora(dateLike) {
  const d = new Date(dateLike);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function getDeviceId() {
  const key = "device_id";
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(key, id);
  }
  return id;
}

export default function AsistenciaMovil() {
  const { user } = useAuth();

  const [sedes, setSedes] = useState([]);
  const [loadingSedes, setLoadingSedes] = useState(true);
  const [sedeId, setSedeId] = useState("");

  const [gpsOn, setGpsOn] = useState(false);
  const [gpsErr, setGpsErr] = useState("");
  const [coords, setCoords] = useState(null);
  const [watchId, setWatchId] = useState(null);

  const [now, setNow] = useState(new Date());
  const [registrosHoy, setRegistrosHoy] = useState([]);
  const [saving, setSaving] = useState(false);

  // refs para detectar transiciones y evitar multi-auto
  const prevGpsOnRef = useRef(false);
  const prevInsideRef = useRef(false);
  const autoLockRef = useRef(false);

  /* =========================
     LOAD SEDES
  ========================= */
  async function loadSedes() {
    setLoadingSedes(true);
    try {
      const res = await sedesApi.list();
      const data = res.data || res;
      if (Array.isArray(data)) {
        setSedes(data);
        if (data.length > 0) setSedeId(String(data[0].id_sede));
      }
    } catch (e) {
      console.error("loadSedes:", e);
    } finally {
      setLoadingSedes(false);
    }
  }

  /* =========================
     LOAD HOY (DB)
  ========================= */
  async function loadHoy() {
    try {
      const res = await asistenciaApi.hoy();
      const data = res.data || res;
      if (Array.isArray(data)) {
        setRegistrosHoy(
          data.map((r) => ({
            tipo: r.tipo,
            sede: r.sede,
            hora: fmtHora(r.ts_servidor),
            ts: r.ts_servidor,
          }))
        );
      }
    } catch (e) {
      console.error("loadHoy:", e);
    }
  }

  useEffect(() => {
    loadSedes();
    loadHoy();
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => {
      clearInterval(t);
      if (watchId != null) navigator.geolocation.clearWatch(watchId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchId]);

  /* =========================
     GPS
  ========================= */
  function activarGps() {
    setGpsErr("");
    if (!("geolocation" in navigator)) {
      setGpsErr("GPS no soportado");
      return;
    }

    const id = navigator.geolocation.watchPosition(
      (pos) => {
        setGpsOn(true);
        setGpsErr("");
        setCoords({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
      },
      (err) => {
        setGpsOn(false);
        setGpsErr(err.message || "Error GPS");
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );

    setWatchId(id);
  }

  function desactivarGps() {
    if (watchId != null) navigator.geolocation.clearWatch(watchId);
    setWatchId(null);
    setGpsOn(false);
  }

  /* =========================
     GEO
  ========================= */
  const sedeSel = useMemo(
    () => sedes.find((s) => String(s.id_sede) === String(sedeId)) || null,
    [sedes, sedeId]
  );

  const geo = useMemo(() => {
    if (!coords || !sedeSel) return { inside: false, dist: null, radio: null };
    const dist = haversineMeters(coords.lat, coords.lng, Number(sedeSel.latitud), Number(sedeSel.longitud));
    const radio = Number(sedeSel.radio_metros || 0);
    return { inside: dist <= radio, dist, radio };
  }, [coords, sedeSel]);

  /* =========================
     ESTADO DE “ENTRADA ABIERTA”
  ========================= */
  const ultimoTipo = registrosHoy[0]?.tipo || null;
  const tieneEntradaActiva = ultimoTipo === "ENTRADA"; // regla simple: último = ENTRADA => abierto
  const puedeEntrada = !tieneEntradaActiva;
  const puedeSalida = tieneEntradaActiva;

  /* =========================
     MARCAR (manual)
  ========================= */
  async function marcar(tipo, { auto = false } = {}) {
    if (!sedeSel) return alert("Selecciona una sede");
    if (!coords) return alert("Activa GPS");
    // ENTRADA requiere dentro
    if (tipo === "ENTRADA" && !geo.inside) return alert("Fuera de la geocerca");

    setSaving(true);
    try {
      await asistenciaApi.marcar({
        id_sede: sedeSel.id_sede,
        tipo,
        latitud: coords.lat,
        longitud: coords.lng,
        dentro_geocerca: Boolean(geo.inside),
        device_id: getDeviceId(),
        auto, // opcional
      });
      await loadHoy();
    } catch (e) {
      console.error("marcar:", e);
      // si backend devuelve 409, muestra mensaje de regla
      const msg = e?.response?.data?.message || "No se pudo registrar";
      alert(msg);
    } finally {
      setSaving(false);
    }
  }

  /* =========================
     AUTO-SALIDA:
     - si GPS pasa de ON -> OFF
     - si GEO pasa de DENTRO -> FUERA
     Solo si hay ENTRADA activa.
  ========================= */
  useEffect(() => {
    const prevGpsOn = prevGpsOnRef.current;
    const prevInside = prevInsideRef.current;

    const gpsSeApago = prevGpsOn === true && gpsOn === false;
    const salioDeGeocerca = prevInside === true && geo.inside === false;

    prevGpsOnRef.current = gpsOn;
    prevInsideRef.current = geo.inside;

    // si no hay entrada activa, no hacemos nada
    if (!tieneEntradaActiva) return;

    // evita disparos múltiples
    if (autoLockRef.current) return;

    // si se apagó GPS o salió de geocerca => marcar salida automática
    if (gpsSeApago || salioDeGeocerca) {
      autoLockRef.current = true;

      // intenta marcar salida aunque geo esté fuera (eso es el punto)
      marcar("SALIDA", { auto: true })
        .catch(() => {})
        .finally(() => {
          // libera lock después de un rato para evitar spam
          setTimeout(() => {
            autoLockRef.current = false;
          }, 4000);
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gpsOn, geo.inside, tieneEntradaActiva]);

  /* =========================
     UI
  ========================= */
  return (
    <div className="min-h-screen bg-[#F1F5F9] pb-10 font-sans text-slate-900">
      {/* HEADER */}
      <div className="bg-[#0F172A] text-white px-6 pt-8 pb-14 rounded-b-[2.5rem] shadow-xl border-b-4 border-[#10B981]">
        <div className="max-w-md mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-black tracking-tighter uppercase italic">
              Asistencia <span className="text-[#10B981]">Móvil</span>
            </h1>
            <p className="text-[10px] text-slate-400 font-bold tracking-[0.2em] uppercase">
              ID: {user?.public_id || "—"}
            </p>
          </div>
          <div className="text-right bg-white/5 p-2 rounded-2xl backdrop-blur-sm border border-white/10">
            <p className="text-2xl font-mono font-bold text-white leading-none">
              {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </p>
            <p className="text-[9px] text-[#10B981] font-bold uppercase mt-1">En Línea</p>
          </div>
        </div>
      </div>

      <main className="max-w-md mx-auto px-5 -mt-8 space-y-4">
        {/* SEDE */}
        <section className="bg-white rounded-2xl p-4 shadow-lg border border-slate-100">
          <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block ml-1 tracking-widest">
            Sede de Trabajo
          </label>
          {loadingSedes ? (
            <div className="text-xs text-slate-400 font-bold">Cargando sedes...</div>
          ) : (
            <select
              className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3.5 px-4 text-sm font-bold text-slate-700 outline-none"
              value={sedeId}
              onChange={(e) => setSedeId(e.target.value)}
            >
              {sedes.map((s) => (
                <option key={s.id_sede} value={s.id_sede}>
                  {s.nombre}
                </option>
              ))}
            </select>
          )}
        </section>

        {/* GPS + GEO */}
        <section className="grid grid-cols-2 gap-4">
          <button
            onClick={() => (gpsOn ? desactivarGps() : activarGps())}
            className={`p-4 rounded-2xl border-2 transition-all text-left shadow-md ${
              gpsOn ? "bg-white border-blue-500" : "bg-slate-50 border-slate-200"
            }`}
          >
            <div className="flex justify-between items-center mb-2">
              <span className="text-[9px] font-black text-slate-400 uppercase">GPS</span>
              {gpsOn && <span className="w-2 h-2 rounded-full bg-blue-600" />}
            </div>
            <p className={`text-xs font-black ${gpsOn ? "text-blue-600" : "text-slate-400"}`}>
              {gpsOn ? "ACTIVO" : "ACTIVAR GPS"}
            </p>
            {coords?.accuracy && <p className="text-[10px] text-slate-400 font-bold">±{Math.round(coords.accuracy)}m</p>}
            {gpsErr && <p className="text-[10px] text-red-500 font-bold">{gpsErr}</p>}
          </button>

          <div
            className={`p-4 rounded-2xl border-2 transition-all shadow-md ${
              geo.inside ? "bg-[#F0FDF4] border-[#10B981]" : "bg-white border-slate-200"
            }`}
          >
            <div className="flex justify-between items-center mb-2">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Geocerca</span>
              <div className={`h-2 w-2 rounded-full ${geo.inside ? "bg-[#10B981]" : "bg-slate-200"}`} />
            </div>
            <p className={`text-xs font-black ${geo.inside ? "text-[#166534]" : "text-slate-400"}`}>
              {geo.inside ? "ZONA AUTORIZADA" : "FUERA DE RANGO"}
            </p>
            {geo.dist != null && <p className="text-[10px] text-slate-400 font-bold">{Math.round(geo.dist)}m</p>}
          </div>
        </section>

        {/* BOTONES */}
        <section className="grid grid-cols-2 gap-4">
          <button
            onClick={() => marcar("ENTRADA")}
            disabled={!gpsOn || !coords || saving || !geo.inside || !puedeEntrada}
            className="py-4 rounded-2xl bg-[#0F172A] text-white font-black text-xs uppercase tracking-[0.15em] shadow-xl active:scale-95 disabled:opacity-20 transition-all"
          >
            {saving ? "Guardando..." : "Entrada"}
          </button>

          <button
            onClick={() => marcar("SALIDA")}
            disabled={!gpsOn || !coords || saving || !puedeSalida}
            className="py-4 rounded-2xl bg-white border-2 border-[#0F172A] text-[#0F172A] font-black text-xs uppercase tracking-[0.15em] shadow-md active:scale-95 disabled:opacity-20 transition-all"
          >
            {saving ? "Guardando..." : "Salida"}
          </button>
        </section>

        {/* MAPA */}
        <section className="rounded-[2.5rem] overflow-hidden shadow-2xl border-4 border-white bg-white relative">
          <div className="h-[240px] w-full">
            <MapPicker
              lat={sedeSel ? Number(sedeSel.latitud) : -2.2038}
              lng={sedeSel ? Number(sedeSel.longitud) : -79.8819}
              userLat={coords?.lat ?? null}
              userLng={coords?.lng ?? null}
              accuracy={coords?.accuracy ?? null}
              radio={sedeSel ? Number(sedeSel.radio_metros || 0) : 0}
            />
          </div>
        </section>

        {/* HISTORIAL */}
        <section className="bg-white rounded-3xl shadow-lg border border-slate-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-50 bg-slate-50/50 flex justify-between items-center">
            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Historial de Hoy</h3>
            <span className="h-2 w-2 rounded-full bg-[#10B981]" />
          </div>

          <div className="max-h-44 overflow-y-auto divide-y divide-slate-50">
            {registrosHoy.length === 0 ? (
              <div className="p-10 text-center text-slate-300 text-[10px] font-bold uppercase tracking-widest italic">
                No hay actividad
              </div>
            ) : (
              registrosHoy.map((r, i) => (
                <div key={i} className="px-6 py-4 flex justify-between items-center">
                  <div>
                    <p className="text-xs font-black">{r.tipo}</p>
                    <p className="text-[9px] text-slate-400 font-bold uppercase">{r.sede}</p>
                  </div>
                  <p className="text-sm font-black">{r.hora}</p>
                </div>
              ))
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
