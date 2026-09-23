import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './', // Relative asset paths for GitHub Pages compatibility
  server: {
    host: true, // Listen on all network addresses (0.0.0.0) for local Wi-Fi smartphone connections
    port: 5173
  }
});
