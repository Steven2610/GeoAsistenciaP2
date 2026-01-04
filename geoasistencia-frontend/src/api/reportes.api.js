// src/api/reportes.api.js
import { http } from "./http";

export const reportesApi = {
  getAsistencia: (params) => http.get("/reportes/asistencia", { params }),
  getAuditoria: () => http.get("/reportes/auditoria"),
  revelarIdentidades: (payload) => http.post("/reportes/revelar-identidades", payload),
};
