import { http } from "./http";

export const sedesApi = {
  list: () => http.get("/sedes"),
  create: (data) => http.post("/sedes", data),
  update: (id, data) => http.put(`/sedes/${id}`, data),
  remove: (id) => http.delete(`/sedes/${id}`),
};
