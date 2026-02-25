import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
    plugins: [
        react(),
        tailwindcss(),
    ],
    resolve: {
        alias: {
            // Points to project root so @/app/... and @/styles/... work
            '@': path.resolve(__dirname, '.'),
        },
    },
    test: {
        environment: 'jsdom',
        globals: true,
    },
})
