import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';
import type { RoleType } from '../db/types.ts';

// 1. JWT Secret Management & Production Hardening
const isProduction = process.env.NODE_ENV === 'production';
const rawSecret = process.env.JWT_SECRET;
const INSECURE_DEFAULT_SECRET = 'inventra_enterprise_secure_jwt_secret_key_2026';

if (isProduction) {
  if (!rawSecret || rawSecret === INSECURE_DEFAULT_SECRET || rawSecret.trim().length < 32) {
    throw new Error(
      '[FATAL SECURITY CONFIGURATION] In production mode (NODE_ENV=production), process.env.JWT_SECRET is REQUIRED and must be a unique, high-entropy secret string of at least 32 characters. Default/fallback keys are strictly rejected.'
    );
  }
}

const SECRET_KEY = rawSecret || INSECURE_DEFAULT_SECRET;

export interface AuthPayload {
  userId: string;
  email: string;
  name: string;
  role: RoleType;
  department: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthPayload;
}

// 2. OWASP-Compliant Password Hashing (PBKDF2-HMAC-SHA512, 210,000 iterations, 16-byte cryptographically secure salt)
export const OWASP_PBKDF2_ITERATIONS = 210000;

export function hashPassword(password: string): string {
  if (!password || typeof password !== 'string') {
    throw new Error('Password must be a non-empty string');
  }
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, OWASP_PBKDF2_ITERATIONS, 64, 'sha512').toString('hex');
  return `pbkdf2:sha512:${OWASP_PBKDF2_ITERATIONS}:${salt}:${hash}`;
}

export function needsRehash(storedHash: string): boolean {
  if (!storedHash || typeof storedHash !== 'string') return true;
  return !storedHash.startsWith(`pbkdf2:sha512:${OWASP_PBKDF2_ITERATIONS}:`);
}

export function verifyPassword(password: string, storedHash: string): boolean {
  try {
    if (!password || !storedHash) return false;

    // A. OWASP Standard Format: pbkdf2:sha512:<iterations>:<salt>:<hash>
    if (storedHash.startsWith('pbkdf2:sha512:')) {
      const parts = storedHash.split(':');
      if (parts.length !== 5) return false;
      const iterations = parseInt(parts[2], 10);
      const salt = parts[3];
      const keyHex = parts[4];
      if (isNaN(iterations) || iterations < 1000 || !salt || !keyHex) return false;

      const testHash = crypto.pbkdf2Sync(password, salt, iterations, 64, 'sha512').toString('hex');
      const keyBuf = Buffer.from(keyHex, 'hex');
      const testBuf = Buffer.from(testHash, 'hex');
      if (keyBuf.length !== testBuf.length) return false;
      return crypto.timingSafeEqual(keyBuf, testBuf);
    }

    // B. Legacy Format for backward compatibility: <salt>:<hash>
    const parts = storedHash.split(':');
    if (parts.length === 2) {
      const [salt, keyHex] = parts;
      if (!salt || !keyHex) return false;

      const keyBuf = Buffer.from(keyHex, 'hex');

      // Check 10,000 iterations
      const test10k = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
      const test10kBuf = Buffer.from(test10k, 'hex');
      if (keyBuf.length === test10kBuf.length && crypto.timingSafeEqual(keyBuf, test10kBuf)) {
        return true;
      }

      // Check legacy 1,000 iterations (seed data compatibility)
      const test1k = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
      const test1kBuf = Buffer.from(test1k, 'hex');
      if (keyBuf.length === test1kBuf.length && crypto.timingSafeEqual(keyBuf, test1kBuf)) {
        return true;
      }
    }

    return false;
  } catch {
    return false;
  }
}

// 3. Token Generation & Verification (Stateless HMAC-SHA256 Token)
export function signToken(payload: AuthPayload): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const exp = Math.floor(Date.now() / 1000) + (60 * 60 * 24); // 24 hours
  const body = Buffer.from(JSON.stringify({ ...payload, exp })).toString('base64url');
  const signature = crypto.createHmac('sha256', SECRET_KEY).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${signature}`;
}

export function verifyToken(token: string): AuthPayload | null {
  try {
    if (!token || typeof token !== 'string') return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [header, body, signature] = parts;

    const expectedSig = crypto.createHmac('sha256', SECRET_KEY).update(`${header}.${body}`).digest('base64url');
    // Constant time comparison for signature check
    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expectedSig);
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return null;
    }

    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null; // Expired
    }

    if (!payload.userId || !payload.role) {
      return null;
    }

    return {
      userId: payload.userId,
      email: payload.email,
      name: payload.name,
      role: payload.role,
      department: payload.department || '',
    };
  } catch {
    return null;
  }
}

// 4. Role-Permission Matrix Definition
export const ROLE_PERMISSIONS: Record<RoleType, string[]> = {
  SUPER_ADMIN: [
    'items:read', 'items:create', 'items:update', 'items:delete',
    'warehouses:read', 'warehouses:create', 'warehouses:update',
    'movements:read', 'movements:in', 'movements:out', 'movements:transfer', 'movements:approve',
    'assets:read', 'assets:create', 'assets:assign', 'assets:maintain',
    'opname:read', 'opname:create', 'opname:adjust',
    'requests:read', 'requests:create', 'requests:approve',
    'reports:read', 'reports:export',
    'audit:read',
    'users:read', 'users:manage',
    'settings:manage'
  ],
  WAREHOUSE_MANAGER: [
    'items:read', 'items:create', 'items:update',
    'warehouses:read',
    'movements:read', 'movements:in', 'movements:out', 'movements:transfer', 'movements:approve',
    'assets:read', 'assets:create', 'assets:assign',
    'opname:read', 'opname:create', 'opname:adjust',
    'requests:read', 'requests:approve',
    'reports:read', 'reports:export',
    'audit:read'
  ],
  INVENTORY_STAFF: [
    'items:read',
    'warehouses:read',
    'movements:read', 'movements:in', 'movements:out',
    'assets:read',
    'opname:read', 'opname:create',
    'requests:read', 'requests:create',
    'reports:read'
  ],
  ASSET_CUSTODIAN: [
    'items:read',
    'warehouses:read',
    'assets:read', 'assets:assign', 'assets:maintain',
    'requests:read', 'requests:create',
    'reports:read'
  ],
  AUDITOR: [
    'items:read',
    'warehouses:read',
    'movements:read',
    'assets:read',
    'opname:read',
    'requests:read',
    'reports:read', 'reports:export',
    'audit:read'
  ]
};

export function hasPermission(role: RoleType, permission: string): boolean {
  const permissions = ROLE_PERMISSIONS[role] || [];
  return permissions.includes(permission);
}

// 5. Express Middlewares (Strict Token Authentication without bypass backdoors)
export function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;

  if (!token) {
    res.status(401).json({ error: 'Akses ditolak. Token otentikasi tidak ditemukan.' });
    return;
  }

  const payload = verifyToken(token);
  if (!payload) {
    res.status(403).json({ error: 'Token otentikasi tidak valid atau telah kedaluwarsa.' });
    return;
  }

  req.user = payload;
  next();
}

export function requirePermission(permission: string) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Akses ditolak. Pengguna belum terautentikasi.' });
      return;
    }
    if (!hasPermission(req.user.role, permission)) {
      res.status(403).json({
        error: `Akses ditolak. Peran '${req.user.role}' tidak memiliki izin '${permission}'.`,
        code: 'FORBIDDEN_PERMISSION'
      });
      return;
    }
    next();
  };
}
