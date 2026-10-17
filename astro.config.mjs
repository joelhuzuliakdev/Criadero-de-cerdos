// @ts-check
import { defineConfig, envField } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import vercel from '@astrojs/vercel';

export default defineConfig({
  // Las páginas se generan estáticas (rápidas); solo /api/* corre en el servidor
  output: 'static',
  adapter: vercel(),
  trailingSlash: 'ignore',
  prefetch: { prefetchAll: true, defaultStrategy: 'hover' },
  env: {
    schema: {
      // Clave secreta de Supabase: solo existe en el servidor, nunca llega al navegador
      SUPABASE_SECRET_KEY: envField.string({ context: 'server', access: 'secret', optional: true }),
    },
  },
  vite: {
    plugins: [tailwindcss()],
  },
});