import { useEffect, useMemo, useRef } from "react";
import { MapContainer, TileLayer, Marker, Circle, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// 1. Configuración global para iconos por defecto (Sede - Azul)
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// 2. Icono personalizado para el USUARIO (Rojo)
// Usamos filter: hue-rotate para cambiar el azul original a rojo
const userIcon = new L.Icon({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
  className: "user-marker-red", // Clase CSS para aplicar el color
});

// Estilo CSS in-line para transformar el icono a rojo
const markerStyle = `
  .user-marker-red {
    filter: hue-rotate(140deg) brightness(0.8) saturate(3);
  }
`;

function ClickHandler({ onPick }) {
  useMapEvents({
    click(e) {
      if (typeof onPick === "function") {
        onPick(e.latlng.lat, e.latlng.lng);
      }
    },
  });
  return null;
}

export default function MapPicker({
  lat,
  lng,
  onPick,
  userLat = null,
  userLng = null,
  accuracy = null,
  radio = null,
}) {
  const mapRef = useRef(null);

  // Inyectamos el estilo para el color rojo una sola vez
  useEffect(() => {
    if (!document.getElementById("leaflet-red-marker-style")) {
      const style = document.createElement("style");
      style.id = "leaflet-red-marker-style";
      style.innerHTML = markerStyle;
      document.head.appendChild(style);
    }
  }, []);

  const center = useMemo(() => {
    const ula = typeof userLat === "number" ? userLat : null;
    const ulo = typeof userLng === "number" ? userLng : null;

    if (ula != null && ulo != null) return [ula, ulo];

    const la = typeof lat === "number" ? lat : -3.9931; // Loja
    const lo = typeof lng === "number" ? lng : -79.2042;
    return [la, lo];
  }, [lat, lng, userLat, userLng]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    setTimeout(() => {
      map.invalidateSize();
    }, 250);
  }, [lat, lng, userLat, userLng]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const targetLat = typeof userLat === "number" ? userLat : typeof lat === "number" ? lat : null;
    const targetLng = typeof userLng === "number" ? userLng : typeof lng === "number" ? lng : null;

    if (targetLat == null || targetLng == null) return;

    setTimeout(() => {
      map.setView([targetLat, targetLng], Math.max(map.getZoom(), 16), { animate: true });
    }, 200);
  }, [userLat, userLng, lat, lng]);

  return (
    <div className="w-full h-[280px] overflow-hidden rounded-xl border">
      <MapContainer
        center={center}
        zoom={16}
        style={{ width: "100%", height: "100%" }}
        ref={mapRef}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png"
          attribution="&copy; OpenStreetMap contributors"
        />

        <ClickHandler onPick={onPick} />

        {/* ✅ Marcador de sede (AZUL - Por defecto) */}
        {typeof lat === "number" && typeof lng === "number" && (
          <>
            <Marker position={[lat, lng]} />
            {typeof radio === "number" && radio > 0 && (
              <Circle 
                center={[lat, lng]} 
                radius={radio} 
                pathOptions={{ color: '#3388ff' }} 
              />
            )}
          </>
        )}

        {/* ✅ Marcador del usuario (ROJO) */}
        {typeof userLat === "number" && typeof userLng === "number" && (
          <>
            <Marker position={[userLat, userLng]} icon={userIcon} />
            {typeof accuracy === "number" && accuracy > 0 && (
              <Circle
                center={[userLat, userLng]}
                radius={Math.max(accuracy, 5)}
                pathOptions={{ color: 'red', fillColor: 'red' }}
              />
            )}
          </>
        )}
      </MapContainer>
    </div>
  );
}