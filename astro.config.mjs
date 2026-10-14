// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
    output: 'static',
    trailingSlash: 'ignore',
    prefetch: { prefetchAll: true, defaultStrategy: 'hover' },
    vite: {
        plugins: [tailwindcss()],
    },
});