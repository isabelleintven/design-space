import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base './' zodat de app werkt op GitHub Pages (subpad) én lokaal
export default defineConfig({
  base: './',
  plugins: [react()],
})
