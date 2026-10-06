import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { DEV_GATEWAY_USER, DEV_PROXY_AUTH_TOKEN } from './scripts/dev-auth.mjs'

export default defineConfig({
    plugins: [
        react(),
        tailwindcss(),
    ],
    server: {
        proxy: {
            '/api': {
                target: process.env.VITE_API_PROXY_TARGET || 'http://localhost:3000',
                changeOrigin: true,
                // Stand in for the production nginx gateway, which injects the
                // proxy token and authenticated user on every /api request.
                headers: {
                    'X-Garden-Proxy-Auth': process.env.GARDEN_PROXY_AUTH_TOKEN || DEV_PROXY_AUTH_TOKEN,
                    'X-Garden-User': process.env.GARDEN_DEV_USER || DEV_GATEWAY_USER,
                },
            },
        },
    },
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
