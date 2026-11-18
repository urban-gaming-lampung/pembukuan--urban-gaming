import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Base path sesuai dengan nama repository Anda jika tidak di Vercel
  base: process.env.VERCEL ? '/' : '/pembukuan--urban-gaming/',
  build: {
    outDir: process.env.VERCEL ? 'dist' : 'docs', // Output diarahkan ke docs
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/storage'],
          charts: ['recharts'],
          icons: ['lucide-react'],
        },
      },
    },
  },
})