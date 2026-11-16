import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import type { ProxyOptions } from 'vite'

const api: ProxyOptions = {
  target: 'http://localhost:4000',
  // If the API is not running, answer with a clear JSON 503 instead of an empty error.
  configure: (proxy) => {
    proxy.on('error', (_error, _request, response) => {
      if ('writeHead' in response && !response.headersSent) {
        response.writeHead(503, { 'Content-Type': 'application/json' })
        response.end(JSON.stringify({ error: 'The API is not running' }))
      }
    })
  },
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Forward API calls and uploaded files to the Express server during development.
    proxy: {
      '/api': api,
      '/uploads': api,
    },
  },
})
