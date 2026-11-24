import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Single-route SPA. Keep the dependency surface small: the <1.5MB initial-load
// budget (spec §3.5) is the hard constraint for low/mid-range Android on mobile data.
export default defineConfig({
  plugins: [react()],
  build: {
    target: 'es2019',
    cssCodeSplit: false,
    reportCompressedSize: true,
    // Two pages: the site, and the 3D venue on its own (the ticket journey embeds it).
    rollupOptions: {
      input: { main: 'index.html', venue: 'venue.html' },
    },
  },
  server: {
    port: 5180,
  },
})
