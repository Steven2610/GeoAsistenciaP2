import { useState, useEffect, useMemo } from "react";
import AdminLayout from "./AdminLayout.jsx";
import { reportesApi } from "../../api/reportes.api";
import { sedesApi } from "../../api/sedes.api";
import { usuariosApi } from "../../api/usuarios.api";

export default function AdminReportes() {
    const [loading, setLoading] = useState(false);
    const [resultados, setResultados] = useState([]);
    const [sedes, setSedes] = useState([]);
    const [usuariosList, setUsuariosList] = useState([]);

    const [kpis, setKpis] = useState({ total: 0, completos: 0, incompletos: 0 });

    const [filtros, setFiltros] = useState({
        tipoReporte: "asistencia",
        fechaDesde: new Date().toISOString().split("T")[0],
        fechaHasta: new Date().toISOString().split("T")[0],
        horaDesde: "00:00",
        horaHasta: "23:59",
        horaEntradaRef: "08:30",
        toleranciaMin: 10,
        id_sede: "all",
        id_usuario: "all",
    });

    const [openAudit, setOpenAudit] = useState(false);
    const [motivo, setMotivo] = useState("");
    const [revelando, setRevelando] = useState(false);
    const [identidadesReveladas, setIdentidadesReveladas] = useState({});

    useEffect(() => {
        const loadFilters = async () => {
            try {
                const [sRes, uRes] = await Promise.all([sedesApi.list(), usuariosApi.list()]);
                setSedes(sRes.data || []);
                setUsuariosList(uRes.data?.usuarios || []);
            } catch (e) {
                console.error("Error al cargar filtros", e);
            }
        };
        loadFilters();
    }, []);

    const isAsistencia = filtros.tipoReporte !== "auditoria";

    // Helpers tiempo
    const toMinutes = (hhmm) => {
        if (!hhmm || typeof hhmm !== "string" || !hhmm.includes(":")) return 0;
        const [h, m] = hhmm.split(":").map((x) => Number(x));
        return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
    };

    const minutesOfDayFromISO = (isoDateOrDate) => {
        const d = isoDateOrDate instanceof Date ? isoDateOrDate : new Date(isoDateOrDate);
        if (Number.isNaN(d.getTime())) return null;
        return d.getHours() * 60 + d.getMinutes();
    };

    const formatTime = (iso) => {
        try {
            return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
        } catch {
            return "—";
        }
    };

    // Filtrado por horario (solo frontend)
    const resultadosFiltrados = useMemo(() => {
        if (!Array.isArray(resultados)) return [];
        if (!isAsistencia) return resultados;

        const minDesde = toMinutes(filtros.horaDesde);
        const minHasta = toMinutes(filtros.horaHasta);

        return resultados.filter((r) => {
            if (filtros.id_usuario !== "all" && String(r.id_usuario) !== String(filtros.id_usuario)) return false;

            // Mantener incompletos visibles
            if (!r.entrada) return true;

            const m = minutesOfDayFromISO(r.entrada);
            if (m === null) return true;
            return m >= minDesde && m <= minHasta;
        });
    }, [resultados, filtros.id_usuario, filtros.horaDesde, filtros.horaHasta, isAsistencia]);

    // KPIs extras (promedio horas, puntualidad, ausencias)
    const kpisExtra = useMemo(() => {
        if (!isAsistencia) return { promedioHoras: 0, puntualidadPct: 0, ausencias: 0, completos: 0, incompletos: 0 };

        const data = resultadosFiltrados;
        const completos = data.filter((r) => r.entrada && r.salida);
        const incompletos = data.filter((r) => !r.entrada || !r.salida);

        let sumaHoras = 0;
        let nHoras = 0;
        completos.forEach((r) => {
            const h = Number(r.horas);
            if (Number.isFinite(h)) {
                sumaHoras += h;
                nHoras += 1;
            }
        });
        const promedioHoras = nHoras ? +(sumaHoras / nHoras).toFixed(2) : 0;

        const ref = toMinutes(filtros.horaEntradaRef) + Number(filtros.toleranciaMin || 0);
        let puntuales = 0;
        let nEntradas = 0;

        data.forEach((r) => {
            if (!r.entrada) return;
            const m = minutesOfDayFromISO(r.entrada);
            if (m === null) return;
            nEntradas += 1;
            if (m <= ref) puntuales += 1;
        });

        const puntualidadPct = nEntradas ? Math.round((puntuales / nEntradas) * 100) : 0;

        // “Ausencias” aproximadas: registros sin entrada
        const ausencias = data.filter((r) => !r.entrada).length;

        return { promedioHoras, puntualidadPct, ausencias, completos: completos.length, incompletos: incompletos.length };
    }, [resultadosFiltrados, filtros.horaEntradaRef, filtros.toleranciaMin, isAsistencia]);

    // Resumen por sede
    const resumenPorSede = useMemo(() => {
        if (!isAsistencia) return [];
        const ref = toMinutes(filtros.horaEntradaRef) + Number(filtros.toleranciaMin || 0);

        const map = new Map();
        for (const r of resultadosFiltrados) {
            const key = r.sede || "—";
            if (!map.has(key)) {
                map.set(key, { sede: key, total: 0, completos: 0, incompletos: 0, sumaHoras: 0, nHoras: 0, puntuales: 0, nEntradas: 0 });
            }
            const row = map.get(key);
            row.total += 1;

            const comp = !!(r.entrada && r.salida);
            if (comp) row.completos += 1;
            else row.incompletos += 1;

            const h = Number(r.horas);
            if (comp && Number.isFinite(h)) {
                row.sumaHoras += h;
                row.nHoras += 1;
            }

            if (r.entrada) {
                const m = minutesOfDayFromISO(r.entrada);
                if (m !== null) {
                    row.nEntradas += 1;
                    if (m <= ref) row.puntuales += 1;
                }
            }
        }

        const out = Array.from(map.values()).map((x) => ({
            ...x,
            promedioHoras: x.nHoras ? +(x.sumaHoras / x.nHoras).toFixed(2) : 0,
            puntualidadPct: x.nEntradas ? Math.round((x.puntuales / x.nEntradas) * 100) : 0,
        }));

        // ordenar por total desc
        out.sort((a, b) => b.total - a.total);
        return out;
    }, [resultadosFiltrados, filtros.horaEntradaRef, filtros.toleranciaMin, isAsistencia]);

    // Resumen por usuario
    const resumenPorUsuario = useMemo(() => {
        if (!isAsistencia) return [];
        const ref = toMinutes(filtros.horaEntradaRef) + Number(filtros.toleranciaMin || 0);

        const map = new Map();
        for (const r of resultadosFiltrados) {
            const key = r.id_usuario || r.public_id || "—";
            if (!map.has(key)) {
                map.set(key, {
                    id_usuario: r.id_usuario,
                    public_id: r.public_id || "—",
                    nombre: identidadesReveladas[r.id_usuario] || "PROTEGIDO",
                    total: 0,
                    completos: 0,
                    incompletos: 0,
                    sumaHoras: 0,
                    nHoras: 0,
                    puntuales: 0,
                    nEntradas: 0,
                });
            }
            const row = map.get(key);
            row.total += 1;

            const comp = !!(r.entrada && r.salida);
            if (comp) row.completos += 1;
            else row.incompletos += 1;

            const h = Number(r.horas);
            if (comp && Number.isFinite(h)) {
                row.sumaHoras += h;
                row.nHoras += 1;
            }

            if (r.entrada) {
                const m = minutesOfDayFromISO(r.entrada);
                if (m !== null) {
                    row.nEntradas += 1;
                    if (m <= ref) row.puntuales += 1;
                }
            }

            // si luego se reveló, actualizar nombre
            if (identidadesReveladas[r.id_usuario]) {
                row.nombre = identidadesReveladas[r.id_usuario];
            }
        }

        const out = Array.from(map.values()).map((x) => ({
            ...x,
            promedioHoras: x.nHoras ? +(x.sumaHoras / x.nHoras).toFixed(2) : 0,
            puntualidadPct: x.nEntradas ? Math.round((x.puntuales / x.nEntradas) * 100) : 0,
        }));

        out.sort((a, b) => b.total - a.total);
        return out;
    }, [resultadosFiltrados, identidadesReveladas, filtros.horaEntradaRef, filtros.toleranciaMin, isAsistencia]);

    const generarReporte = async () => {
        setLoading(true);
        setIdentidadesReveladas({});
        try {
            const apiCall =
                filtros.tipoReporte === "auditoria"
                    ? reportesApi.getAuditoria()
                    : reportesApi.getAsistencia({
                        fechaDesde: filtros.fechaDesde,
                        fechaHasta: filtros.fechaHasta,
                        id_sede: filtros.id_sede,
                        id_usuario: filtros.id_usuario,
                    });

            const { data } = await apiCall;

            if (!isAsistencia) {
                if (Array.isArray(data)) setResultados(data);
                else setResultados(data?.registros || []);
            } else {
                setResultados(data?.resultados || []);
                setKpis(data?.kpis || { total: 0, completos: 0, incompletos: 0 });
            }
        } catch (e) {
            console.error(e);
            alert("Error al obtener los datos del reporte");
        } finally {
            setLoading(false);
        }
    };

    const handleRevelarNombres = async () => {
        if (motivo.trim().length < 5) return alert("Justificación demasiado corta.");
        setRevelando(true);
        try {
            const ids_usuarios = [...new Set(resultadosFiltrados.map((r) => r.id_usuario))].filter(Boolean);
            const { data } = await reportesApi.revelarIdentidades({ motivo, ids_usuarios });

            const mapa = {};
            if (data?.identidades) {
                data.identidades.forEach((i) => (mapa[i.id_usuario] = `${i.nombres} ${i.apellidos}`));
            }
            setIdentidadesReveladas(mapa);
            setOpenAudit(false);
            setMotivo("");
        } catch (e) {
            console.error(e);
            alert("No se pudo completar la auditoría");
        } finally {
            setRevelando(false);
        }
    };

    // ========= EXPORTS =========
    const buildExportRows = () => {
        // Exporta lo que estás viendo (filtrado). Nombre protegido a menos que esté revelado.
        return resultadosFiltrados.map((r) => {
            const nombre = identidadesReveladas[r.id_usuario] || "PROTEGIDO";
            const estado = r.entrada && r.salida ? "COMPLETO" : "INCOMPLETO";

            const ref = toMinutes(filtros.horaEntradaRef) + Number(filtros.toleranciaMin || 0);
            const entradaMin = r.entrada ? minutesOfDayFromISO(r.entrada) : null;
            const puntual = entradaMin !== null ? (entradaMin <= ref ? "SI" : "TARDE") : "—";

            return {
                PUBLIC_ID: r.public_id || "",
                NOMBRE: nombre,
                SEDE: r.sede || "",
                FECHA: r.fecha || "",
                ENTRADA: r.entrada ? formatTime(r.entrada) : "",
                SALIDA: r.salida ? formatTime(r.salida) : "",
                HORAS: Number(r.horas || 0).toFixed(2),
                ESTADO: estado,
                PUNTUALIDAD: puntual,
            };
        });
    };

    const exportExcel = async () => {
        if (!isAsistencia) return alert("Exportación disponible solo para Asistencia.");
        if (!resultadosFiltrados.length) return alert("No hay datos para exportar.");

        try {
            const XLSX = await import("xlsx");
            const { saveAs } = await import("file-saver");

            const rows = buildExportRows();

            const ws = XLSX.utils.json_to_sheet(rows);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Asistencia");

            // hojas adicionales (resúmenes)
            const wsSede = XLSX.utils.json_to_sheet(
                resumenPorSede.map((s) => ({
                    SEDE: s.sede,
                    TOTAL: s.total,
                    COMPLETOS: s.completos,
                    INCOMPLETOS: s.incompletos,
                    PROMEDIO_HORAS: s.promedioHoras,
                    PUNTUALIDAD: `${s.puntualidadPct}%`,
                }))
            );
            XLSX.utils.book_append_sheet(wb, wsSede, "Resumen_Sede");

            const wsUsr = XLSX.utils.json_to_sheet(
                resumenPorUsuario.map((u) => ({
                    PUBLIC_ID: u.public_id,
                    NOMBRE: u.nombre,
                    TOTAL: u.total,
                    COMPLETOS: u.completos,
                    INCOMPLETOS: u.incompletos,
                    PROMEDIO_HORAS: u.promedioHoras,
                    PUNTUALIDAD: `${u.puntualidadPct}%`,
                }))
            );
            XLSX.utils.book_append_sheet(wb, wsUsr, "Resumen_Usuario");

            const fileName = `reporte_asistencia_${filtros.fechaDesde}_${filtros.fechaHasta}.xlsx`;
            const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
            saveAs(new Blob([out], { type: "application/octet-stream" }), fileName);
        } catch (e) {
            console.error(e);
            alert("No se pudo exportar Excel. Verifica que instalaste: xlsx y file-saver.");
        }
    };

    const exportPDF = async () => {
        if (!isAsistencia) return alert("Exportación disponible solo para Asistencia.");
        if (!resultadosFiltrados.length) return alert("No hay datos para exportar.");

        try {
            const { default: jsPDF } = await import("jspdf");
            const autoTableModule = await import("jspdf-autotable");

            // ✅ En Vite/ESM, autoTable puede venir en distintas claves:
            const autoTable =
                autoTableModule.default ||
                autoTableModule.autoTable ||
                autoTableModule;

            const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });

            const title = `Reporte Asistencia (${filtros.fechaDesde} a ${filtros.fechaHasta})`;
            doc.setFont("helvetica", "bold");
            doc.setFontSize(14);
            doc.text(title, 40, 40);

            doc.setFont("helvetica", "normal");
            doc.setFontSize(10);
            doc.text(
                `Total: ${kpis.total} | Completos: ${kpisExtra.completos} | Incompletos: ${kpisExtra.incompletos} | Prom. horas: ${kpisExtra.promedioHoras}h | Puntualidad: ${kpisExtra.puntualidadPct}% | Ausencias: ${kpisExtra.ausencias}`,
                40,
                60
            );

            // Tabla principal
            const rows = buildExportRows();
            const head = [["Public ID", "Nombre", "Sede", "Fecha", "Entrada", "Salida", "Horas", "Estado", "Puntualidad"]];
            const body = rows.map((r) => [r.PUBLIC_ID, r.NOMBRE, r.SEDE, r.FECHA, r.ENTRADA, r.SALIDA, r.HORAS, r.ESTADO, r.PUNTUALIDAD]);

            autoTable(doc, {
                head,
                body,
                startY: 80,
                styles: { fontSize: 8 },
                headStyles: { fillColor: [15, 23, 42] }, // slate-900
                theme: "striped",
                margin: { left: 40, right: 40 },
            });

            // Resumen por sede
            doc.addPage("a4", "landscape");
            doc.setFont("helvetica", "bold");
            doc.setFontSize(12);
            doc.text("Resumen por Sede", 40, 40);

            autoTable(doc, {
                head: [["Sede", "Total", "Completos", "Incompletos", "Prom. horas", "Puntualidad"]],
                body: resumenPorSede.map((s) => [s.sede, s.total, s.completos, s.incompletos, `${s.promedioHoras}h`, `${s.puntualidadPct}%`]),
                startY: 60,
                styles: { fontSize: 9 },
                headStyles: { fillColor: [15, 23, 42] },
                theme: "striped",
                margin: { left: 40, right: 40 },
            });

            // Resumen por usuario
            doc.addPage("a4", "landscape");
            doc.setFont("helvetica", "bold");
            doc.setFontSize(12);
            doc.text("Resumen por Usuario", 40, 40);

            autoTable(doc, {
                head: [["Public ID", "Nombre", "Total", "Completos", "Incompletos", "Prom. horas", "Puntualidad"]],
                body: resumenPorUsuario.map((u) => [u.public_id, u.nombre, u.total, u.completos, u.incompletos, `${u.promedioHoras}h`, `${u.puntualidadPct}%`]),
                startY: 60,
                styles: { fontSize: 9 },
                headStyles: { fillColor: [15, 23, 42] },
                theme: "striped",
                margin: { left: 40, right: 40 },
            });

            const fileName = `reporte_asistencia_${filtros.fechaDesde}_${filtros.fechaHasta}.pdf`;
            doc.save(fileName);
        } catch (e) {
            console.error(e);
            alert("No se pudo exportar PDF. Revisa la consola (F12) para el error exacto.");
        }
    };


    return (
        <AdminLayout title="Reportes" subtitle="Análisis de asistencia y registros auditados">
            <div className="space-y-8">
                {/* Barra acciones (Excel / PDF) */}
                {isAsistencia && (
                    <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-end">
                        <button
                            onClick={exportExcel}
                            className="h-[42px] px-4 rounded-xl font-bold text-sm bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm"
                            disabled={loading}
                            title="Exportar resultados y resúmenes"
                        >
                            Exportar Excel
                        </button>
                        <button
                            onClick={exportPDF}
                            className="h-[42px] px-4 rounded-xl font-bold text-sm bg-rose-600 text-white hover:bg-rose-700 shadow-sm"
                            disabled={loading}
                            title="Exportar PDF con tabla y resúmenes"
                        >
                            Exportar PDF
                        </button>
                    </div>
                )}

                {/* KPIs */}
                {isAsistencia && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
                        <KpiCard title="Total registros" value={kpis.total} icon="📊" />
                        <KpiCard title="Completos" value={kpisExtra.completos} icon="✅" />
                        <KpiCard title="Incompletos" value={kpisExtra.incompletos} icon="⚠️" />
                        <KpiCard title="Promedio horas" value={`${kpisExtra.promedioHoras}h`} icon="⏱️" />
                        <KpiCard title="Puntualidad" value={`${kpisExtra.puntualidadPct}%`} icon="🎯" />
                        <KpiCard title="Ausencias" value={kpisExtra.ausencias} icon="🚫" />
                    </div>
                )}

                {/* Filtros */}
                <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 items-end">
                        <Field label="Tipo de reporte">
                            <select
                                className="w-full border border-gray-200 p-2.5 rounded-xl text-sm outline-none focus:ring-2 focus:ring-slate-900"
                                value={filtros.tipoReporte}
                                onChange={(e) => setFiltros({ ...filtros, tipoReporte: e.target.value })}
                            >
                                <option value="asistencia">Asistencia (general)</option>
                                <option value="auditoria">Auditoría (revelación)</option>
                            </select>
                        </Field>

                        <Field label="Desde (fecha)">
                            <input
                                type="date"
                                className="w-full border border-gray-200 p-2.5 rounded-xl text-sm"
                                value={filtros.fechaDesde}
                                onChange={(e) => setFiltros({ ...filtros, fechaDesde: e.target.value })}
                                disabled={!isAsistencia}
                            />
                        </Field>

                        <Field label="Hasta (fecha)">
                            <input
                                type="date"
                                className="w-full border border-gray-200 p-2.5 rounded-xl text-sm"
                                value={filtros.fechaHasta}
                                onChange={(e) => setFiltros({ ...filtros, fechaHasta: e.target.value })}
                                disabled={!isAsistencia}
                            />
                        </Field>

                        <Field label="Sede">
                            <select
                                className="w-full border border-gray-200 p-2.5 rounded-xl text-sm"
                                value={filtros.id_sede}
                                onChange={(e) => setFiltros({ ...filtros, id_sede: e.target.value })}
                                disabled={!isAsistencia}
                            >
                                <option value="all">Todas las sedes</option>
                                {sedes.map((s) => (
                                    <option key={s.id_sede} value={s.id_sede}>
                                        {s.nombre}
                                    </option>
                                ))}
                            </select>
                        </Field>

                        <Field label="Usuario">
                            <select
                                className="w-full border border-gray-200 p-2.5 rounded-xl text-sm"
                                value={filtros.id_usuario}
                                onChange={(e) => setFiltros({ ...filtros, id_usuario: e.target.value })}
                                disabled={!isAsistencia}
                            >
                                <option value="all">Todos los usuarios</option>
                                {usuariosList.map((u) => (
                                    <option key={u.id_usuario} value={u.id_usuario}>
                                        {u.public_id} — {u.email}
                                    </option>
                                ))}
                            </select>
                        </Field>

                        <button
                            onClick={generarReporte}
                            disabled={loading}
                            className="bg-slate-900 text-white h-[45px] rounded-xl font-bold text-sm hover:bg-slate-800 transition-all shadow-lg shadow-slate-200 disabled:opacity-50"
                        >
                            {loading ? "Cargando..." : "Generar reporte"}
                        </button>
                    </div>

                    {/* Controles horario/puntualidad */}
                    {isAsistencia && (
                        <div className="mt-6 grid grid-cols-1 md:grid-cols-4 lg:grid-cols-6 gap-4 items-end">
                            <Field label="Hora desde">
                                <input
                                    type="time"
                                    className="w-full border border-gray-200 p-2.5 rounded-xl text-sm"
                                    value={filtros.horaDesde}
                                    onChange={(e) => setFiltros({ ...filtros, horaDesde: e.target.value })}
                                />
                            </Field>

                            <Field label="Hora hasta">
                                <input
                                    type="time"
                                    className="w-full border border-gray-200 p-2.5 rounded-xl text-sm"
                                    value={filtros.horaHasta}
                                    onChange={(e) => setFiltros({ ...filtros, horaHasta: e.target.value })}
                                />
                            </Field>

                            <Field label="Hora entrada (ref)">
                                <input
                                    type="time"
                                    className="w-full border border-gray-200 p-2.5 rounded-xl text-sm"
                                    value={filtros.horaEntradaRef}
                                    onChange={(e) => setFiltros({ ...filtros, horaEntradaRef: e.target.value })}
                                />
                            </Field>

                            <Field label="Tolerancia (min)">
                                <input
                                    type="number"
                                    min={0}
                                    max={120}
                                    className="w-full border border-gray-200 p-2.5 rounded-xl text-sm"
                                    value={filtros.toleranciaMin}
                                    onChange={(e) => setFiltros({ ...filtros, toleranciaMin: Number(e.target.value) })}
                                />
                            </Field>

                            <div className="md:col-span-2 lg:col-span-2">
                                <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4 text-xs text-gray-600">
                                    <div className="font-bold text-gray-800 mb-1">Cómo se calcula “puntualidad”</div>
                                    Entrada ≤ <span className="font-mono">{filtros.horaEntradaRef}</span> + {filtros.toleranciaMin} min
                                    <div className="text-gray-500 mt-1">El filtro de “Hora desde/hasta” afecta los resultados mostrados.</div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Resúmenes */}
                {isAsistencia && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <CardTable
                            title="Resumen por Sede"
                            subtitle="Totales, horas promedio y puntualidad por sede"
                            columns={[
                                { key: "sede", label: "Sede" },
                                { key: "total", label: "Total", align: "text-right" },
                                { key: "completos", label: "Completos", align: "text-right" },
                                { key: "incompletos", label: "Incompletos", align: "text-right" },
                                { key: "promedioHoras", label: "Prom. horas", align: "text-right", format: (v) => `${v}h` },
                                { key: "puntualidadPct", label: "Puntualidad", align: "text-right", format: (v) => `${v}%` },
                            ]}
                            rows={resumenPorSede}
                            emptyText="Genera un reporte para ver el resumen por sede"
                        />

                        <CardTable
                            title="Resumen por Usuario"
                            subtitle="Rendimiento por usuario (con privacidad)"
                            columns={[
                                { key: "public_id", label: "Usuario" },
                                { key: "nombre", label: "Nombre", format: (v) => (v === "PROTEGIDO" ? "Protegido" : v) },
                                { key: "total", label: "Total", align: "text-right" },
                                { key: "completos", label: "Completos", align: "text-right" },
                                { key: "incompletos", label: "Incompletos", align: "text-right" },
                                { key: "promedioHoras", label: "Prom. horas", align: "text-right", format: (v) => `${v}h` },
                                { key: "puntualidadPct", label: "Puntualidad", align: "text-right", format: (v) => `${v}%` },
                            ]}
                            rows={resumenPorUsuario}
                            emptyText="Genera un reporte para ver el resumen por usuario"
                        />
                    </div>
                )}

                {/* Tabla principal */}
                <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b bg-gray-50 flex items-center justify-between">
                        <div className="text-[11px] font-black text-gray-400 uppercase tracking-widest">
                            {isAsistencia ? "Resultados del reporte" : "Logs de auditoría"}
                        </div>

                        {isAsistencia && resultadosFiltrados.length > 0 && !Object.keys(identidadesReveladas).length && (
                            <button
                                onClick={() => setOpenAudit(true)}
                                className="text-xs bg-slate-900 text-white px-3 py-1.5 rounded-lg font-bold hover:bg-slate-800"
                            >
                                🔓 Revelar nombres (auditar)
                            </button>
                        )}
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-white text-[11px] uppercase tracking-widest text-gray-400 border-b">
                                <tr>
                                    {isAsistencia ? (
                                        <>
                                            <th className="px-6 py-4">Usuario</th>
                                            <th className="px-6 py-4">Nombre real</th>
                                            <th className="px-6 py-4">Sede</th>
                                            <th className="px-6 py-4">Fecha</th>
                                            <th className="px-6 py-4 text-center">Entrada</th>
                                            <th className="px-6 py-4 text-center">Salida</th>
                                            <th className="px-6 py-4 text-right">Horas</th>
                                            <th className="px-6 py-4 text-center">Estado</th>
                                            <th className="px-6 py-4 text-center">Puntual</th>
                                        </>
                                    ) : (
                                        <>
                                            <th className="px-6 py-4">Actor (Admin)</th>
                                            <th className="px-6 py-4">Acción</th>
                                            <th className="px-6 py-4">Motivo</th>
                                            <th className="px-6 py-4">IP</th>
                                            <th className="px-6 py-4 text-right">Fecha/Hora</th>
                                        </>
                                    )}
                                </tr>
                            </thead>

                            <tbody className="divide-y divide-gray-50">
                                {isAsistencia ? (
                                    <>
                                        {resultadosFiltrados.map((r, i) => {
                                            const ref = toMinutes(filtros.horaEntradaRef) + Number(filtros.toleranciaMin || 0);
                                            const entradaMin = r.entrada ? minutesOfDayFromISO(r.entrada) : null;
                                            const esPuntual = entradaMin !== null ? entradaMin <= ref : false;
                                            const estado = r.entrada && r.salida ? "Completo" : "Incompleto";

                                            return (
                                                <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                                                    <td className="px-6 py-4 font-bold text-gray-900">{r.public_id}</td>
                                                    <td className="px-6 py-4 text-gray-600">
                                                        {identidadesReveladas[r.id_usuario] || (
                                                            <span className="text-gray-300 italic">Protegido</span>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-4">{r.sede}</td>
                                                    <td className="px-6 py-4">{r.fecha}</td>

                                                    <td className="px-6 py-4 text-center font-bold text-gray-900">
                                                        {r.entrada ? formatTime(r.entrada) : "—"}
                                                    </td>
                                                    <td className="px-6 py-4 text-center font-bold text-gray-900">
                                                        {r.salida ? formatTime(r.salida) : "—"}
                                                    </td>

                                                    <td className="px-6 py-4 text-right font-black text-gray-900">
                                                        {Number(r.horas || 0).toFixed(2)}h
                                                    </td>

                                                    <td className="px-6 py-4 text-center">
                                                        <span
                                                            className={`px-2 py-1 rounded-lg text-[11px] font-bold border ${estado === "Completo"
                                                                    ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                                                                    : "bg-amber-50 text-amber-700 border-amber-100"
                                                                }`}
                                                        >
                                                            {estado}
                                                        </span>
                                                    </td>

                                                    <td className="px-6 py-4 text-center">
                                                        {r.entrada ? (
                                                            <span
                                                                className={`px-2 py-1 rounded-lg text-[11px] font-bold border ${esPuntual
                                                                        ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                                                                        : "bg-rose-50 text-rose-700 border-rose-100"
                                                                    }`}
                                                            >
                                                                {esPuntual ? "Sí" : "Tarde"}
                                                            </span>
                                                        ) : (
                                                            <span className="text-gray-300">—</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}

                                        {resultadosFiltrados.length === 0 && (
                                            <tr>
                                                <td colSpan={9} className="px-6 py-20 text-center text-gray-300 font-bold uppercase tracking-widest">
                                                    Sin resultados
                                                </td>
                                            </tr>
                                        )}
                                    </>
                                ) : (
                                    <>
                                        {resultados.map((r, i) => (
                                            <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                                                <td className="px-6 py-4 font-bold">
                                                    {r.usuario_actor?.public_id || r.actor_id_usuario || "—"}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="bg-slate-50 text-slate-700 px-2 py-1 rounded-md text-[10px] font-bold border border-slate-100">
                                                        {r.accion}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-gray-500 italic max-w-xs truncate">{r.motivo}</td>
                                                <td className="px-6 py-4 text-gray-400 font-mono text-xs">{r.ip}</td>
                                                <td className="px-6 py-4 text-right text-gray-400">
                                                    {r.created_at ? new Date(r.created_at).toLocaleString() : "—"}
                                                </td>
                                            </tr>
                                        ))}

                                        {resultados.length === 0 && (
                                            <tr>
                                                <td colSpan={5} className="px-6 py-20 text-center text-gray-300 font-bold uppercase tracking-widest">
                                                    Sin resultados
                                                </td>
                                            </tr>
                                        )}
                                    </>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Modal Auditoría (naranja como antes) */}
                {openAudit && (
                    <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                        <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden border border-gray-100">
                            <div className="p-6 bg-gradient-to-r from-orange-500 to-red-500 text-white">
                                <div className="text-lg font-extrabold">Revelar Identidad</div>
                                <div className="text-xs opacity-90">Acción auditada y registrada</div>
                            </div>

                            <div className="p-6 space-y-4">
                                <div className="bg-orange-50 border border-orange-100 p-4 rounded-2xl text-xs text-orange-700">
                                    ⚠️ Esta acción revelará información personal protegida y quedará registrada en auditoría.
                                </div>

                                <div className="bg-gray-50 border border-gray-100 p-4 rounded-2xl text-sm">
                                    <div className="text-[10px] font-black text-gray-400 tracking-widest uppercase mb-1">Registros afectados</div>
                                    <div className="font-bold text-gray-900">{resultadosFiltrados.length} registros (usuarios únicos: {new Set(resultadosFiltrados.map(r => r.id_usuario)).size})</div>
                                    <div className="text-xs text-gray-500 mt-1">Los nombres serán visibles solo en esta sesión.</div>
                                </div>

                                <div>
                                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1 mb-1">
                                        Motivo de la consulta <span className="text-red-500">*</span>
                                    </div>
                                    <textarea
                                        className="w-full border border-gray-200 rounded-2xl p-4 text-sm outline-none focus:ring-2 focus:ring-orange-400"
                                        placeholder="Describe el motivo..."
                                        rows={4}
                                        maxLength={500}
                                        value={motivo}
                                        onChange={(e) => setMotivo(e.target.value)}
                                    />
                                    <div className="text-xs text-gray-400 mt-1">{motivo.length}/500 caracteres</div>
                                </div>

                                <div className="flex gap-3 pt-2">
                                    <button
                                        onClick={() => setOpenAudit(false)}
                                        className="flex-1 py-3 text-sm font-bold text-gray-500 bg-white border border-gray-200 rounded-2xl hover:bg-gray-50"
                                    >
                                        Cancelar
                                    </button>

                                    <button
                                        onClick={handleRevelarNombres}
                                        disabled={revelando}
                                        className="flex-1 bg-orange-600 text-white py-3 rounded-2xl font-bold hover:bg-orange-700 disabled:opacity-50"
                                    >
                                        {revelando ? "Procesando..." : "Confirmar y revelar"}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </AdminLayout>
    );
}

/* ======= UI components ======= */

function KpiCard({ title, value, icon }) {
    return (
        <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm flex items-center justify-between">
            <div>
                <p className="text-[10px] font-black text-gray-400 tracking-widest uppercase mb-1">{title}</p>
                <p className="text-2xl font-black text-gray-900">{value}</p>
            </div>
            <div className="w-11 h-11 flex items-center justify-center rounded-2xl text-lg bg-slate-50 text-slate-700 border border-slate-100">
                {icon}
            </div>
        </div>
    );
}

function Field({ label, children }) {
    return (
        <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{label}</label>
            {children}
        </div>
    );
}

function CardTable({ title, subtitle, columns, rows, emptyText }) {
    return (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b bg-gray-50">
                <div className="text-[11px] font-black text-gray-400 uppercase tracking-widest">{title}</div>
                <div className="text-xs text-gray-500 mt-1">{subtitle}</div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="bg-white text-[11px] uppercase tracking-widest text-gray-400 border-b">
                        <tr>
                            {columns.map((c) => (
                                <th key={c.key} className={`px-6 py-4 ${c.align || ""}`}>{c.label}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {rows?.length ? (
                            rows.slice(0, 8).map((r, i) => (
                                <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                                    {columns.map((c) => (
                                        <td key={c.key} className={`px-6 py-4 ${c.align || ""}`}>
                                            {c.format ? c.format(r[c.key], r) : r[c.key]}
                                        </td>
                                    ))}
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan={columns.length} className="px-6 py-10 text-center text-gray-300 font-bold uppercase tracking-widest">
                                    {emptyText}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {rows?.length > 8 && (
                <div className="px-6 py-3 text-xs text-gray-500 border-t bg-white">
                    Mostrando 8 de {rows.length}. Exporta Excel/PDF para ver todo.
                </div>
            )}
        </div>
    );
}
