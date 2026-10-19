import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { repoManager } from './server/db/repository.ts';
import { testDatabaseConnectivity, parseAndMaskDatabaseUrl } from './server/db/connection.ts';
import { 
  signToken, 
  verifyPassword, 
  hashPassword,
  needsRehash,
  authenticateToken, 
  requirePermission, 
  hasPermission,
  ROLE_PERMISSIONS,
  AuthenticatedRequest 
} from './server/security/auth.ts';
import type { RoleType } from './server/db/types.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;
  const isProduction = process.env.NODE_ENV === 'production';

  // Initialize Active Repository (MySQL or standalone store)
  await repoManager.init();

  app.use(express.json({ limit: '5mb' }));

  // Request logger for audit trail (sanitizes sensitive payload fields)
  app.use((req, res, next) => {
    if (req.path.startsWith('/api') && req.method !== 'GET') {
      const sanitizedBody = { ...req.body };
      if (sanitizedBody.password) sanitizedBody.password = '[REDACTED]';
      if (sanitizedBody.token) sanitizedBody.token = '[REDACTED]';
      console.log(`[API ${req.method}] ${req.path}`);
    }
    next();
  });

  // ---------------------------------------------------------------------------
  // HEALTH CHECK & DATABASE CONNECTIVITY
  // ---------------------------------------------------------------------------
  app.get('/api/health', async (req, res) => {
    try {
      const dbHealth = await testDatabaseConnectivity();
      const isOk = dbHealth.status === 'CONNECTED' || (!isProduction && dbHealth.status === 'NOT_CONFIGURED');
      
      res.status(isOk ? 200 : 503).json({
        status: isOk ? 'UP' : 'DEGRADED',
        timestamp: new Date().toISOString(),
        environment: isProduction ? 'production' : 'development',
        activeEngine: repoManager.getActiveEngine(),
        database: dbHealth,
        uptime: process.uptime(),
      });
    } catch (err: any) {
      res.status(500).json({
        status: 'DOWN',
        error: err.message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  // ---------------------------------------------------------------------------
  // AUTH ROUTES
  // ---------------------------------------------------------------------------
  app.post('/api/auth/login', async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        res.status(400).json({ error: 'Email dan password wajib diisi.' });
        return;
      }

      const repo = await repoManager.getRepository();
      const user = await repo.findUserByEmail(email);

      if (!user || !verifyPassword(password, user.passwordHash)) {
        res.status(401).json({ error: 'Email atau password salah.' });
        return;
      }

      // OWASP Migration: Silently upgrade legacy password hashes to PBKDF2-SHA512
      if (needsRehash(user.passwordHash)) {
        try {
          const upgradedHash = hashPassword(password);
          await repo.updateUserPassword(user.id, upgradedHash);
          console.log(`[AUTH SECURITY] Upgraded legacy password hash to OWASP PBKDF2-SHA512 for user ${user.email}`);
        } catch (rehashErr) {
          console.warn('[AUTH SECURITY] Failed to upgrade password hash:', rehashErr);
        }
      }

      if (!user.isActive) {
        res.status(403).json({ error: 'Akun Anda sedang dinonaktifkan. Silakan hubungi administrator.' });
        return;
      }

      const token = signToken({
        userId: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        department: user.department,
      });

      const { passwordHash, ...safeUser } = user;
      await repo.logAudit({
        action: 'USER_LOGIN',
        entity: 'User',
        entityId: user.id,
        userId: user.id,
        userName: user.name,
        ipAddress: req.ip,
        detailsJson: { role: user.role }
      });

      res.json({ 
        token, 
        user: {
          ...safeUser,
          permissions: ROLE_PERMISSIONS[safeUser.role] || []
        }
      });
    } catch (err: any) {
      console.error('[AUTH ERROR] Login failed:', err);
      res.status(500).json({ error: 'Terjadi kesalahan sistem saat proses masuk.' });
    }
  });

  app.get('/api/auth/me', authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const repo = await repoManager.getRepository();
      const user = await repo.findUserById(req.user!.userId);

      if (!user) {
        // Fallback for session token
        res.json({
          user: {
            id: req.user!.userId,
            email: req.user!.email,
            name: req.user!.name,
            role: req.user!.role,
            department: req.user!.department,
            permissions: ROLE_PERMISSIONS[req.user!.role] || []
          }
        });
        return;
      }

      const { passwordHash, ...safeUser } = user;
      res.json({
        user: {
          ...safeUser,
          permissions: ROLE_PERMISSIONS[safeUser.role] || []
        }
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Switch role: Restricted in production, available in dev for convenience testing
  app.post('/api/auth/switch-role', async (req, res) => {
    if (isProduction) {
      res.status(403).json({ 
        error: 'Peralihan peran instan dinonaktifkan pada lingkungan produksi. Silakan login dengan akun yang sesuai.',
        code: 'SWITCH_ROLE_DISABLED_IN_PROD'
      });
      return;
    }

    const { role } = req.body as { role: RoleType };
    if (!role || !ROLE_PERMISSIONS[role]) {
      res.status(400).json({ error: 'Peran tidak valid.' });
      return;
    }

    try {
      const repo = await repoManager.getRepository();
      const users = await repo.getUsers();
      const matchedUser = users.find(u => u.role === role) || users[0];

      const token = signToken({
        userId: matchedUser.id,
        email: matchedUser.email,
        name: matchedUser.name,
        role: matchedUser.role,
        department: matchedUser.department,
      });

      res.json({
        token,
        user: {
          ...matchedUser,
          permissions: ROLE_PERMISSIONS[matchedUser.role] || []
        }
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ---------------------------------------------------------------------------
  // DASHBOARD METRICS
  // ---------------------------------------------------------------------------
  app.get('/api/dashboard', authenticateToken, async (req, res) => {
    try {
      const repo = await repoManager.getRepository();
      const { items } = await repo.getItems({ limit: 1000 });
      const warehouses = await repo.getWarehouses();
      const { movements } = await repo.getStockMovements({ limit: 10 });
      const assets = await repo.getAssetUnits();

      let totalStockValuation = 0;
      let lowStockCount = 0;
      let outOfStockCount = 0;

      for (const item of items) {
        totalStockValuation += item.currentStock * item.unitCost;
        if (item.currentStock <= 0) {
          outOfStockCount++;
        } else if (item.currentStock <= item.minStock) {
          lowStockCount++;
        }
      }

      const warehouseBreakdown = warehouses.map(wh => {
        let whItemCount = 0;
        let whTotalQty = 0;
        for (const item of items) {
          const bal = item.stockBalances?.find(b => b.warehouseId === wh.id);
          if (bal && bal.quantity > 0) {
            whItemCount++;
            whTotalQty += bal.quantity;
          }
        }
        return {
          id: wh.id,
          code: wh.code,
          name: wh.name,
          branch: wh.branch,
          itemCount: whItemCount,
          totalQty: whTotalQty,
          capacityCbm: wh.capacityCbm
        };
      });

      const movementTrends = [
        { month: 'Mei', in: 420, out: 380, transfer: 95 },
        { month: 'Jun', in: 510, out: 490, transfer: 110 },
        { month: 'Jul', in: 460, out: 430, transfer: 80 },
        { month: 'Agu', in: 580, out: 540, transfer: 140 },
        { month: 'Sep', in: 620, out: 590, transfer: 130 },
        { month: 'Okt', in: 710, out: 645, transfer: 165 },
      ];

      res.json({
        summary: {
          totalItems: items.length,
          totalStockValuation,
          lowStockCount,
          outOfStockCount,
          totalWarehouses: warehouses.length,
          activeAssetUnits: assets.filter(a => a.status === 'AVAILABLE' || a.status === 'ASSIGNED').length,
          inMaintenanceAssets: assets.filter(a => a.status === 'IN_MAINTENANCE').length,
        },
        warehouseBreakdown,
        recentMovements: movements.slice(0, 5),
        movementTrends,
        lowStockItems: items.filter(i => i.currentStock <= i.minStock).slice(0, 5)
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ---------------------------------------------------------------------------
  // MASTER ITEMS & INVENTORY
  // ---------------------------------------------------------------------------
  app.get('/api/items', authenticateToken, async (req, res) => {
    try {
      const repo = await repoManager.getRepository();
      const { search, categoryId, itemType, stockStatus, page, limit } = req.query;
      const result = await repo.getItems({
        search: search as string,
        categoryId: categoryId as string,
        itemType: itemType as string,
        stockStatus: stockStatus as any,
        page: page ? parseInt(page as string, 10) : 1,
        limit: limit ? parseInt(limit as string, 10) : 50,
      });
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/items/:id', authenticateToken, async (req, res) => {
    try {
      const repo = await repoManager.getRepository();
      const item = await repo.getItemById(req.params.id);
      if (!item) {
        res.status(404).json({ error: 'Barang tidak ditemukan.' });
        return;
      }
      const allAssets = await repo.getAssetUnits();
      const assetUnits = item.itemType === 'SERIALIZED_ASSET' 
        ? allAssets.filter(a => a.itemId === item.id)
        : [];
      res.json({ item, assetUnits });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/items', authenticateToken, requirePermission('items:create'), async (req: AuthenticatedRequest, res) => {
    try {
      const {
        sku,
        barcode,
        name,
        description,
        categoryId,
        unitId,
        supplierId,
        itemType,
        minStock,
        maxStock,
        reorderPoint,
        safetyStock,
        unitCost,
        unitPrice,
        specifications,
        initialStock
      } = req.body;

      if (!sku || !name || !categoryId || !unitId) {
        res.status(400).json({ error: 'SKU, Nama Barang, Kategori, dan Satuan wajib diisi.' });
        return;
      }

      const repo = await repoManager.getRepository();
      const newItem = await repo.createItem({
        sku,
        barcode: barcode || undefined,
        name,
        description: description || '',
        categoryId,
        unitId,
        supplierId: supplierId || undefined,
        itemType: itemType || 'CONSUMABLE',
        currentStock: Number(initialStock) || 0,
        minStock: Number(minStock) || 10,
        maxStock: Number(maxStock) || 500,
        reorderPoint: Number(reorderPoint) || 20,
        safetyStock: Number(safetyStock) || 5,
        unitCost: Number(unitCost) || 0,
        unitPrice: Number(unitPrice) || 0,
        specifications: specifications || {},
        isActive: true
      });

      await repo.logAudit({
        action: 'CREATE_ITEM',
        entity: 'Item',
        entityId: newItem.id,
        userId: req.user?.userId,
        userName: req.user?.name,
        detailsJson: { sku: newItem.sku, name: newItem.name, type: newItem.itemType }
      });

      res.status(201).json({ item: newItem });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Gagal membuat barang baru.' });
    }
  });

  app.put('/api/items/:id', authenticateToken, requirePermission('items:update'), async (req: AuthenticatedRequest, res) => {
    try {
      const repo = await repoManager.getRepository();
      const updated = await repo.updateItem(req.params.id, req.body);
      await repo.logAudit({
        action: 'UPDATE_ITEM',
        entity: 'Item',
        entityId: updated.id,
        userId: req.user?.userId,
        userName: req.user?.name,
        detailsJson: { sku: updated.sku, name: updated.name }
      });
      res.json({ item: updated });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Gagal memperbarui barang.' });
    }
  });

  // ---------------------------------------------------------------------------
  // WAREHOUSES, CATEGORIES, SUPPLIERS, UNITS
  // ---------------------------------------------------------------------------
  app.get('/api/warehouses', authenticateToken, async (req, res) => {
    try {
      const repo = await repoManager.getRepository();
      res.json({ warehouses: await repo.getWarehouses() });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/warehouses', authenticateToken, requirePermission('warehouses:create'), async (req: AuthenticatedRequest, res) => {
    try {
      const { code, name, branch, address, capacityCbm } = req.body;
      if (!code || !name || !branch) {
        res.status(400).json({ error: 'Kode, nama gudang, dan cabang wajib diisi.' });
        return;
      }
      const repo = await repoManager.getRepository();
      const newWh = await repo.createWarehouse({
        code,
        name,
        branch,
        address: address || '',
        capacityCbm: Number(capacityCbm) || 1000,
        isActive: true,
      });
      await repo.logAudit({
        action: 'CREATE_WAREHOUSE',
        entity: 'Warehouse',
        entityId: newWh.id,
        userId: req.user?.userId,
        userName: req.user?.name,
        detailsJson: { code: newWh.code, name: newWh.name }
      });
      res.status(201).json({ warehouse: newWh });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.get('/api/categories', authenticateToken, async (req, res) => {
    try {
      const repo = await repoManager.getRepository();
      res.json({ categories: await repo.getCategories() });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/suppliers', authenticateToken, async (req, res) => {
    try {
      const repo = await repoManager.getRepository();
      res.json({ suppliers: await repo.getSuppliers() });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/units', authenticateToken, async (req, res) => {
    try {
      const repo = await repoManager.getRepository();
      res.json({ units: await repo.getUnits() });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ---------------------------------------------------------------------------
  // STOCK MOVEMENTS (Goods Receipt, Stock Out, Transfer, Returns)
  // ---------------------------------------------------------------------------
  app.get('/api/movements', authenticateToken, async (req, res) => {
    try {
      const { type, warehouseId, page, limit } = req.query;
      const repo = await repoManager.getRepository();
      const result = await repo.getStockMovements({
        type: type as any,
        warehouseId: warehouseId as string,
        page: page ? parseInt(page as string, 10) : 1,
        limit: limit ? parseInt(limit as string, 10) : 50,
      });
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/movements', authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const {
        type,
        sourceWarehouseId,
        targetWarehouseId,
        supplierId,
        referenceDoc,
        idempotencyKey,
        notes,
        details
      } = req.body;

      if (!type || !details || details.length === 0) {
        res.status(400).json({ error: 'Tipe mutasi dan daftar barang wajib diisi.' });
        return;
      }

      // Check permission based on movement type
      if (type === 'IN' && !hasPermission(req.user!.role, 'movements:in')) {
        res.status(403).json({ error: 'Akses ditolak untuk transaksi barang masuk.' });
        return;
      }
      if (type === 'OUT' && !hasPermission(req.user!.role, 'movements:out')) {
        res.status(403).json({ error: 'Akses ditolak untuk transaksi barang keluar.' });
        return;
      }
      if (type === 'TRANSFER' && !hasPermission(req.user!.role, 'movements:transfer')) {
        res.status(403).json({ error: 'Akses ditolak untuk mutasi transfer antar gudang.' });
        return;
      }

      const repo = await repoManager.getRepository();
      const movement = await repo.executeStockMovement({
        type,
        sourceWarehouseId,
        targetWarehouseId,
        supplierId,
        referenceDoc,
        idempotencyKey,
        notes,
        createdByUserId: req.user!.userId,
        details: details.map((d: any) => ({
          itemId: d.itemId,
          quantity: Number(d.quantity),
          unitCost: d.unitCost !== undefined ? Number(d.unitCost) : undefined,
          notes: d.notes
        }))
      });

      res.status(201).json({ movement });
    } catch (err: any) {
      console.error('[STOCK MOVEMENT ERROR]', err.message);
      res.status(400).json({ error: err.message || 'Transaksi gagal diproses.' });
    }
  });

  // ---------------------------------------------------------------------------
  // SERIALIZED ASSETS
  // ---------------------------------------------------------------------------
  app.get('/api/assets', authenticateToken, async (req, res) => {
    try {
      const { status, condition, warehouseId, assignedToUserId, search } = req.query;
      const repo = await repoManager.getRepository();
      const assets = await repo.getAssetUnits({
        status: status as string,
        condition: condition as string,
        warehouseId: warehouseId as string,
        assignedToUserId: assignedToUserId as string,
        search: search as string,
      });
      res.json({ assets, total: assets.length });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/assets/:id', authenticateToken, async (req, res) => {
    try {
      const repo = await repoManager.getRepository();
      const asset = await repo.getAssetById(req.params.id);
      if (!asset) {
        res.status(404).json({ error: 'Unit aset tidak ditemukan.' });
        return;
      }
      res.json({ asset });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/assets', authenticateToken, requirePermission('assets:create'), async (req: AuthenticatedRequest, res) => {
    try {
      const {
        assetTag,
        serialNumber,
        itemId,
        warehouseId,
        locationId,
        status,
        condition,
        purchaseDate,
        purchaseCost,
        warrantyExpiry,
        notes
      } = req.body;

      if (!assetTag || !serialNumber || !itemId || !warehouseId) {
        res.status(400).json({ error: 'Asset Tag, Serial Number, Item, dan Gudang wajib diisi.' });
        return;
      }

      const repo = await repoManager.getRepository();
      const newAsset = await repo.createAssetUnit({
        assetTag,
        serialNumber,
        itemId,
        warehouseId,
        locationId: locationId || undefined,
        status: status || 'AVAILABLE',
        condition: condition || 'GOOD',
        purchaseDate: purchaseDate || undefined,
        purchaseCost: Number(purchaseCost) || 0,
        warrantyExpiry: warrantyExpiry || undefined,
        notes: notes || undefined
      });

      await repo.logAudit({
        action: 'CREATE_SERIALIZED_ASSET',
        entity: 'AssetUnit',
        entityId: newAsset.id,
        userId: req.user?.userId,
        userName: req.user?.name,
        detailsJson: { assetTag: newAsset.assetTag, serialNumber: newAsset.serialNumber }
      });

      res.status(201).json({ asset: newAsset });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.put('/api/assets/:id/status', authenticateToken, requirePermission('assets:assign'), async (req: AuthenticatedRequest, res) => {
    try {
      const repo = await repoManager.getRepository();
      const updated = await repo.updateAssetStatus(req.params.id, {
        ...req.body,
        assignedByUserId: req.user?.userId
      });

      await repo.logAudit({
        action: 'UPDATE_ASSET_STATUS',
        entity: 'AssetUnit',
        entityId: updated.id,
        userId: req.user?.userId,
        userName: req.user?.name,
        detailsJson: { 
          assetTag: updated.assetTag, 
          status: updated.status, 
          assignedTo: updated.assignedToUserName 
        }
      });

      res.json({ asset: updated });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // ---------------------------------------------------------------------------
  // STOCK OPNAME
  // ---------------------------------------------------------------------------
  app.get('/api/opnames', authenticateToken, async (req, res) => {
    try {
      const repo = await repoManager.getRepository();
      res.json({ opnames: await repo.getStockOpnames() });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/opnames', authenticateToken, requirePermission('opname:create'), async (req: AuthenticatedRequest, res) => {
    try {
      const { warehouseId, scheduledDate, notes, details } = req.body;
      if (!warehouseId || !scheduledDate) {
        res.status(400).json({ error: 'Gudang dan tanggal jadwal stock opname wajib diisi.' });
        return;
      }

      const repo = await repoManager.getRepository();
      const opname = await repo.createStockOpname({
        warehouseId,
        scheduledDate,
        status: 'IN_PROGRESS',
        notes: notes || '',
        details: (details || []).map((d: any) => ({
          id: `opnd-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          opnameId: '',
          itemId: d.itemId,
          itemSku: d.itemSku,
          itemName: d.itemName,
          systemStock: Number(d.systemStock) || 0,
          physicalStock: Number(d.physicalStock) || 0,
          difference: (Number(d.physicalStock) || 0) - (Number(d.systemStock) || 0),
          unitCost: Number(d.unitCost) || 0,
          discrepancyValue: ((Number(d.physicalStock) || 0) - (Number(d.systemStock) || 0)) * (Number(d.unitCost) || 0),
          notes: d.notes
        }))
      });

      await repo.logAudit({
        action: 'CREATE_STOCK_OPNAME',
        entity: 'StockOpname',
        entityId: opname.id,
        userId: req.user?.userId,
        userName: req.user?.name,
        detailsJson: { opnameNumber: opname.opnameNumber, warehouseId }
      });

      res.status(201).json({ opname });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // ---------------------------------------------------------------------------
  // ITEM REQUESTS / REQUISITIONS
  // ---------------------------------------------------------------------------
  app.get('/api/requests', authenticateToken, async (req, res) => {
    try {
      const repo = await repoManager.getRepository();
      res.json({ requests: await repo.getItemRequests() });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/requests', authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const { department, urgency, reason, details } = req.body;
      if (!reason || !details || details.length === 0) {
        res.status(400).json({ error: 'Alasan permintaan dan minimal 1 item wajib diisi.' });
        return;
      }

      const repo = await repoManager.getRepository();
      const newReq = await repo.createItemRequest({
        department: department || req.user?.department || 'Operations',
        urgency: urgency || 'NORMAL',
        status: 'PENDING',
        reason,
        requestedByUserId: req.user!.userId,
        details: details.map((d: any) => ({
          id: `ird-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          requestId: '',
          itemId: d.itemId,
          itemSku: d.itemSku,
          itemName: d.itemName,
          requestedQty: Number(d.requestedQty) || 1
        }))
      });

      await repo.logAudit({
        action: 'CREATE_ITEM_REQUEST',
        entity: 'ItemRequest',
        entityId: newReq.id,
        userId: req.user?.userId,
        userName: req.user?.name,
        detailsJson: { requestNumber: newReq.requestNumber, urgency: newReq.urgency }
      });

      res.status(201).json({ request: newReq });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // ---------------------------------------------------------------------------
  // USERS & ROLES MATRIX
  // ---------------------------------------------------------------------------
  app.get('/api/users', authenticateToken, requirePermission('users:read'), async (req, res) => {
    try {
      const repo = await repoManager.getRepository();
      res.json({ 
        users: await repo.getUsers(),
        rolePermissions: ROLE_PERMISSIONS 
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ---------------------------------------------------------------------------
  // AUDIT TRAIL
  // ---------------------------------------------------------------------------
  app.get('/api/audit', authenticateToken, requirePermission('audit:read'), async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 100;
      const repo = await repoManager.getRepository();
      res.json({ auditLogs: await repo.getAuditLogs(limit) });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ---------------------------------------------------------------------------
  // SYSTEM STATUS & MYSQL DIAGNOSTICS
  // ---------------------------------------------------------------------------
  app.get('/api/system/status', async (req, res) => {
    const dbHealth = await testDatabaseConnectivity();
    const maskedInfo = parseAndMaskDatabaseUrl(process.env.DATABASE_URL);

    res.json({
      systemName: 'NGA Inventra Enterprise Inventory & Asset Management',
      version: '1.2.0-hostinger-ready',
      status: 'OPERATIONAL',
      activeEngine: repoManager.getActiveEngine(),
      databaseStatus: {
        configuredUrl: maskedInfo.maskedUrl,
        host: maskedInfo.host,
        port: maskedInfo.port,
        databaseName: maskedInfo.database,
        connectionState: dbHealth.status,
        engine: dbHealth.engine,
        databaseVersion: dbHealth.databaseVersion,
        latencyMs: dbHealth.latencyMs,
        lastError: dbHealth.error || null,
        targetEngine: 'MySQL 8.0+ / MariaDB 10.5+ via Prisma ORM',
        verificationState: dbHealth.status === 'CONNECTED' 
          ? 'TERVERIFIKASI TERHUBUNG KE MYSQL DENGAN QUERY AKTIF (SELECT 1 & SELECT VERSION)'
          : 'BELUM TERVERIFIKASI TERHADAP INSTANCE MYSQL EKSTERNAL (Container environment isolated)',
        migrationsReady: true,
        migrationFile: 'migrations/init_mysql.sql',
        schemaFile: 'prisma/schema.prisma'
      },
      security: {
        passwordHashing: 'PBKDF2-SHA512 with 16-byte random salt',
        tokenType: 'HMAC-SHA256 Token',
        demoBypassHardened: true,
        idempotencySupport: true,
        concurrencyLocking: true,
        negativeStockPrevention: true
      }
    });
  });

  // ---------------------------------------------------------------------------
  // VITE / STATIC SERVING
  // ---------------------------------------------------------------------------
  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
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
