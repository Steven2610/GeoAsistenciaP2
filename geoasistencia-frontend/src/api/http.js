import axios from "axios";

export const http = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  headers: { "Content-Type": "application/json" },
});

http.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

http.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err?.response?.status;

    // Si token inválido/expirado -> limpiar sesión y volver al login
    if (status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");

      // evita loops si ya estás en /login
      if (!window.location.pathname.includes("/login")) {
        window.location.href = "/login";
      }
    }

    return Promise.reject(err);
  }
);
