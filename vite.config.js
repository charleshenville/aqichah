import fs from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const root = path.dirname(new URL(import.meta.url).pathname);

// GitHub Pages (and most static hosts) answer unknown paths with 404.html, so
// the built index is copied there and deep links like /software/quad-trees
// still boot the app.
const spaFallback = () => ({
    name: 'spa-fallback',
    apply: 'build',
    closeBundle() {
        const out = path.join(root, 'dist');
        const index = path.join(out, 'index.html');
        if (fs.existsSync(index)) fs.copyFileSync(index, path.join(out, '404.html'));
    },
});

export default defineConfig({
    plugins: [react(), spaFallback()],
    worker: { format: 'es' },
    build: {
        target: 'es2020',
        assetsInlineLimit: 2048,
        chunkSizeWarningLimit: 900,
        rollupOptions: {
            output: {
                // three.js is shared by the landing manifold and most tools:
                // one cached chunk instead of a copy per route.
                manualChunks: (id) => (id.includes('node_modules/three/') ? 'three' : undefined),
            },
        },
    },
});
