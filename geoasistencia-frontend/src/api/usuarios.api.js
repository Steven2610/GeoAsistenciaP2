import { http } from "./http";

export const usuariosApi = {
  list: () => http.get("/admin/usuarios"),
  create: (data) => http.post("/admin/usuarios", data),
  update: (id, data) => http.put(`/admin/usuarios/${id}`, data),
  toggleEstado: (id) => http.patch(`/admin/usuarios/${id}/estado`),

  // ✅ NUEVO
  revelarIdentidad: (id, motivo) =>
    http.post(`/admin/usuarios/${id}/identidad`, { motivo }),
};
