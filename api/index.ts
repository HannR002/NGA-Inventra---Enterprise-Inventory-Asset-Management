import { createApp } from '../server/app.ts';
import { repoManager } from '../server/db/repository.ts';

const app = createApp();

let initialized = false;
let initPromise: Promise<void> | null = null;

async function ensureInitialized() {
  if (initialized) return;
  if (!initPromise) {
    initPromise = repoManager.init().then(() => {
      initialized = true;
    }).catch(err => {
      initPromise = null;
      console.error('[VERCEL SERVERLESS] Database repository init error:', err);
      throw err;
    });
  }
  await initPromise;
}

// Vercel Serverless Function Handler
export default async function handler(req: any, res: any) {
  await ensureInitialized();
  return app(req, res);
}
