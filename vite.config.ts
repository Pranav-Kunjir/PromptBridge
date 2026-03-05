import { defineConfig, Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { spawn } from 'child_process'

const backendManagerPlugin = (): Plugin => ({
  name: 'backend-manager',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (req.url === '/__start-backend' && req.method === 'POST') {
        spawn('npx', ['ts-node', 'src/index.ts'], {
          cwd: './backend',
          stdio: 'inherit',
          shell: true
        });
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ status: 'Starting backend...' }));
        return;
      }
      next();
    });
  }
});

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), backendManagerPlugin()],
  server: {
    proxy: {
      '/health': 'http://localhost:3000',
      '/admin': 'http://localhost:3000',
      '/chat': 'http://localhost:3000'
    }
  }
})
