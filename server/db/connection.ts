import { PrismaClient } from '@prisma/client';
import mysql from 'mysql2/promise';

export interface DatabaseHealthInfo {
  status: 'CONNECTED' | 'DISCONNECTED' | 'NOT_CONFIGURED';
  engine: 'PRISMA_MYSQL' | 'MYSQL2_POOL' | 'JSON_SIMULATION';
  latencyMs: number | null;
  databaseVersion: string | null;
  databaseName: string | null;
  host: string | null;
  error?: string;
  checkedAt: string;
}

// 1. Connection URL Parser for safe logging (masks passwords)
export function parseAndMaskDatabaseUrl(rawUrl?: string): {
  isConfigured: boolean;
  maskedUrl: string;
  host: string | null;
  port: number | null;
  database: string | null;
  user: string | null;
} {
  if (!rawUrl || !rawUrl.trim()) {
    return {
      isConfigured: false,
      maskedUrl: 'NOT_SET',
      host: null,
      port: null,
      database: null,
      user: null,
    };
  }

  try {
    const url = new URL(rawUrl);
    const host = url.hostname;
    const port = url.port ? parseInt(url.port, 10) : 3306;
    const database = url.pathname.replace(/^\//, '');
    const user = url.username;

    // Mask password
    const maskedUrl = `${url.protocol}//${user ? `${user}:****@` : ''}${host}:${port}/${database}`;

    return {
      isConfigured: true,
      maskedUrl,
      host,
      port,
      database,
      user,
    };
  } catch {
    return {
      isConfigured: true,
      maskedUrl: 'INVALID_URL_FORMAT',
      host: null,
      port: null,
      database: null,
      user: null,
    };
  }
}

// 2. Serverless-Safe Singleton Prisma Client & Connection Pool Manager
const globalForDb = globalThis as unknown as {
  prismaClientInstance?: PrismaClient;
  mysqlPoolInstance?: mysql.Pool;
};

export function getPrismaClient(): PrismaClient | null {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    return null;
  }

  if (!globalForDb.prismaClientInstance) {
    globalForDb.prismaClientInstance = new PrismaClient({
      datasources: {
        db: {
          url: dbUrl,
        },
      },
      log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    });
  }

  return globalForDb.prismaClientInstance;
}

// 3. MySQL2 Pool for low-overhead healthchecks and raw queries
export function getMysqlPool(): mysql.Pool | null {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) return null;

  if (!globalForDb.mysqlPoolInstance) {
    try {
      const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
      globalForDb.mysqlPoolInstance = mysql.createPool({
        uri: dbUrl,
        waitForConnections: true,
        connectionLimit: isServerless ? 3 : 10,
        maxIdle: isServerless ? 2 : 10,
        idleTimeout: 30000,
        queueLimit: 0,
        enableKeepAlive: true,
        keepAliveInitialDelay: 10000,
      });
    } catch (err) {
      console.error('[DB] Failed to create MySQL2 pool:', err);
      return null;
    }
  }

  return globalForDb.mysqlPoolInstance;
}

// 4. Real Database Health Check (executes SELECT 1 and SELECT VERSION())
export async function testDatabaseConnectivity(): Promise<DatabaseHealthInfo> {
  const dbUrl = process.env.DATABASE_URL;
  const parsed = parseAndMaskDatabaseUrl(dbUrl);

  if (!parsed.isConfigured) {
    return {
      status: 'NOT_CONFIGURED',
      engine: 'JSON_SIMULATION',
      latencyMs: null,
      databaseVersion: null,
      databaseName: null,
      host: null,
      checkedAt: new Date().toISOString(),
      error: 'Variabel lingkungan DATABASE_URL belum diatur.',
    };
  }

  const start = performance.now();

  // Try Prisma first if instantiated
  const prisma = getPrismaClient();
  if (prisma) {
    try {
      const result = await prisma.$queryRaw<Array<{ version?: string; 'VERSION()': string }>>`SELECT VERSION() as version`;
      const latencyMs = Math.round(performance.now() - start);
      const dbVersion = result && result[0] ? (result[0].version || result[0]['VERSION()'] || 'MySQL 8.0') : 'MySQL';

      return {
        status: 'CONNECTED',
        engine: 'PRISMA_MYSQL',
        latencyMs,
        databaseVersion: String(dbVersion),
        databaseName: parsed.database,
        host: parsed.host,
        checkedAt: new Date().toISOString(),
      };
    } catch (prismaErr: any) {
      // If Prisma query failed, try mysql2 pool fallback before declaring failure
      console.warn('[DB] Prisma query failed, attempting direct mysql2 ping:', prismaErr.message);
    }
  }

  // Direct mysql2 ping test
  const pool = getMysqlPool();
  if (pool) {
    try {
      const conn = await pool.getConnection();
      try {
        const [rows] = await conn.query('SELECT VERSION() as version, 1 as ping');
        const latencyMs = Math.round(performance.now() - start);
        const version = Array.isArray(rows) && (rows[0] as any)?.version ? (rows[0] as any).version : 'Unknown';

        return {
          status: 'CONNECTED',
          engine: 'MYSQL2_POOL',
          latencyMs,
          databaseVersion: String(version),
          databaseName: parsed.database,
          host: parsed.host,
          checkedAt: new Date().toISOString(),
        };
      } finally {
        conn.release();
      }
    } catch (poolErr: any) {
      const latencyMs = Math.round(performance.now() - start);
      return {
        status: 'DISCONNECTED',
        engine: 'PRISMA_MYSQL',
        latencyMs,
        databaseVersion: null,
        databaseName: parsed.database,
        host: parsed.host,
        error: `Gagal terhubung ke MySQL (${parsed.host}): ${poolErr.message}`,
        checkedAt: new Date().toISOString(),
      };
    }
  }

  return {
    status: 'DISCONNECTED',
    engine: 'PRISMA_MYSQL',
    latencyMs: null,
    databaseVersion: null,
    databaseName: parsed.database,
    host: parsed.host,
    error: 'Tidak dapat menginisialisasi driver MySQL.',
    checkedAt: new Date().toISOString(),
  };
}
