import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { createApp } from './server/app.ts';
import { repoManager } from './server/db/repository.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const PORT = process.env.PORT || 3000;
  const isProduction = process.env.NODE_ENV === 'production';

  // Initialize Active Repository (MySQL or standalone store)
  await repoManager.init();

  const app = createApp();

  // ---------------------------------------------------------------------------
  // VITE / STATIC SERVING (Only used when running standalone Node server)
  // ---------------------------------------------------------------------------
  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  const server = app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`[NGA INVENTRA] Server active on port ${PORT} [Mode: ${isProduction ? 'Production' : 'Development'}]`);
  });

  // Graceful shutdown
  const shutdown = async () => {
    console.log('[NGA INVENTRA] Shutting down gracefully...');
    server.close();
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
