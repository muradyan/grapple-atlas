/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'

// Dev-only: receive the in-browser debug log and write it to disk
// (bjj-session.log) so it can be inspected/analyzed outside the browser.
function bjjLogger(): Plugin {
  const file = path.resolve('bjj-session.log')
  return {
    name: 'bjj-logger',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__bjjlog', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          return res.end()
        }
        let body = ''
        req.on('data', (c) => (body += c))
        req.on('end', () => {
          try {
            const e = JSON.parse(body) as { type?: string; line?: string }
            const text = (e.line ?? '') + '\n'
            if (e.type === 'start') fs.writeFileSync(file, text)
            else fs.appendFileSync(file, text)
          } catch {
            /* ignore malformed */
          }
          res.statusCode = 204
          res.end()
        })
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), bjjLogger()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
  },
})
