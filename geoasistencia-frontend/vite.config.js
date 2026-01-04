import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
//export default defineConfig({ plugins: [react()] }) este es el que debe ede estar
// esto de aca abko es solo para pruevas
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    allowedHosts: true, // 👈 permite todos los hosts externos (ngrok)
  },
});