import { http } from "./http";

export const asistenciaApi = {
  marcar: (payload) => http.post("/asistencia/marcar", payload),
  hoy: () => http.get("/asistencia/hoy"),
};
