import { http } from "./http";

export const authApi = {
  login: (data) => http.post("/auth/login", data).then((r) => r.data),
  registerEmpleado: (data) => http.post("/auth/register-empleado", data).then((r) => r.data),
  // opcional
  register: (data) => http.post("/auth/register", data).then((r) => r.data),
};
