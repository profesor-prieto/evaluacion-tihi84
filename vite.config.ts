/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// En GitHub Pages el sitio se sirve en /<repo>/. Se puede sobrescribir con VITE_BASE.
export default defineConfig({
  base: process.env.VITE_BASE ?? '/evaluacion-tihi84/',
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
