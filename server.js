// server.ts
import express from "express";
import path2 from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";

// server/db/connection.ts
import { PrismaClient } from "@prisma/client";
import mysql from "mysql2/promise";
function parseAndMaskDatabaseUrl(rawUrl) {
  if (!rawUrl || !rawUrl.trim()) {
    return {
      isConfigured: false,
      maskedUrl: "NOT_SET",
      host: null,
      port: null,
      database: null,
      user: null
    };
  }
  try {
    const url = new URL(rawUrl);
    const host = url.hostname;
    const port = url.port ? parseInt(url.port, 10) : 3306;
    const database = url.pathname.replace(/^\//, "");
    const user = url.username;
    const maskedUrl = `${url.protocol}//${user ? `${user}:****@` : ""}${host}:${port}/${database}`;
    return {
      isConfigured: true,
      maskedUrl,
      host,
      port,
      database,
      user
    };
  } catch {
    return {
      isConfigured: true,
      maskedUrl: "INVALID_URL_FORMAT",
      host: null,
      port: null,
      database: null,
      user: null
    };
  }
}
var prismaClientInstance = null;
function getPrismaClient() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    return null;
  }
  if (!prismaClientInstance) {
    prismaClientInstance = new PrismaClient({
      datasources: {
        db: {
          url: dbUrl
        }
      },
      log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"]
    });
  }
  return prismaClientInstance;
}
var mysqlPoolInstance = null;
function getMysqlPool() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) return null;
  if (!mysqlPoolInstance) {
    try {
      mysqlPoolInstance = mysql.createPool({
        uri: dbUrl,
        waitForConnections: true,
        connectionLimit: 10,
        maxIdle: 10,
        idleTimeout: 6e4,
        queueLimit: 0,
        enableKeepAlive: true,
        keepAliveInitialDelay: 1e4
      });
    } catch (err) {
      console.error("[DB] Failed to create MySQL2 pool:", err);
      return null;
    }
  }
  return mysqlPoolInstance;
}
async function testDatabaseConnectivity() {
  const dbUrl = process.env.DATABASE_URL;
  const parsed = parseAndMaskDatabaseUrl(dbUrl);
  if (!parsed.isConfigured) {
    return {
      status: "NOT_CONFIGURED",
      engine: "JSON_SIMULATION",
      latencyMs: null,
      databaseVersion: null,
      databaseName: null,
      host: null,
      checkedAt: (/* @__PURE__ */ new Date()).toISOString(),
      error: "Variabel lingkungan DATABASE_URL belum diatur."
    };
  }
  const start = performance.now();
  const prisma = getPrismaClient();
  if (prisma) {
    try {
      const result = await prisma.$queryRaw`SELECT VERSION() as version`;
      const latencyMs = Math.round(performance.now() - start);
      const dbVersion = result && result[0] ? result[0].version || result[0]["VERSION()"] || "MySQL 8.0" : "MySQL";
      return {
        status: "CONNECTED",
        engine: "PRISMA_MYSQL",
        latencyMs,
        databaseVersion: String(dbVersion),
        databaseName: parsed.database,
        host: parsed.host,
        checkedAt: (/* @__PURE__ */ new Date()).toISOString()
      };
    } catch (prismaErr) {
      console.warn("[DB] Prisma query failed, attempting direct mysql2 ping:", prismaErr.message);
    }
  }
  const pool = getMysqlPool();
  if (pool) {
    try {
      const conn = await pool.getConnection();
      try {
        const [rows] = await conn.query("SELECT VERSION() as version, 1 as ping");
        const latencyMs = Math.round(performance.now() - start);
        const version = Array.isArray(rows) && rows[0]?.version ? rows[0].version : "Unknown";
        return {
          status: "CONNECTED",
          engine: "MYSQL2_POOL",
          latencyMs,
          databaseVersion: String(version),
          databaseName: parsed.database,
          host: parsed.host,
          checkedAt: (/* @__PURE__ */ new Date()).toISOString()
        };
      } finally {
        conn.release();
      }
    } catch (poolErr) {
      const latencyMs = Math.round(performance.now() - start);
      return {
        status: "DISCONNECTED",
        engine: "PRISMA_MYSQL",
        latencyMs,
        databaseVersion: null,
        databaseName: parsed.database,
        host: parsed.host,
        error: `Gagal terhubung ke MySQL (${parsed.host}): ${poolErr.message}`,
        checkedAt: (/* @__PURE__ */ new Date()).toISOString()
      };
    }
  }
  return {
    status: "DISCONNECTED",
    engine: "PRISMA_MYSQL",
    latencyMs: null,
    databaseVersion: null,
    databaseName: parsed.database,
    host: parsed.host,
    error: "Tidak dapat menginisialisasi driver MySQL.",
    checkedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
}

// server/db/mysqlRepository.ts
var PrismaMySQLRepository = class {
  constructor(prisma) {
    this.prisma = prisma;
  }
  // --- Users ---
  async findUserByEmail(email) {
    const u = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    });
    if (!u) return null;
    return {
      id: u.id,
      email: u.email,
      passwordHash: u.passwordHash,
      name: u.name,
      role: u.role,
      department: u.department || "",
      avatarUrl: u.avatarUrl || void 0,
      isActive: u.isActive,
      createdAt: u.createdAt.toISOString(),
      updatedAt: u.updatedAt ? u.updatedAt.toISOString() : u.createdAt.toISOString()
    };
  }
  async findUserById(id) {
    const u = await this.prisma.user.findUnique({
      where: { id }
    });
    if (!u) return null;
    return {
      id: u.id,
      email: u.email,
      passwordHash: u.passwordHash,
      name: u.name,
      role: u.role,
      department: u.department || "",
      avatarUrl: u.avatarUrl || void 0,
      isActive: u.isActive,
      createdAt: u.createdAt.toISOString(),
      updatedAt: u.updatedAt ? u.updatedAt.toISOString() : u.createdAt.toISOString()
    };
  }
  async getUsers() {
    const users = await this.prisma.user.findMany({
      orderBy: { createdAt: "desc" }
    });
    return users.map((u) => ({
      id: u.id,
      email: u.email,
      passwordHash: "",
      // never expose passwordHash
      name: u.name,
      role: u.role,
      department: u.department || "",
      avatarUrl: u.avatarUrl || void 0,
      isActive: u.isActive,
      createdAt: u.createdAt.toISOString(),
      updatedAt: u.updatedAt ? u.updatedAt.toISOString() : u.createdAt.toISOString()
    }));
  }
  // --- Categories, Units, Suppliers ---
  async getCategories() {
    const list = await this.prisma.category.findMany({ orderBy: { name: "asc" } });
    return list.map((c) => ({
      id: c.id,
      code: c.code,
      name: c.name,
      description: c.description || "",
      createdAt: c.createdAt.toISOString()
    }));
  }
  async getUnits() {
    const list = await this.prisma.unit.findMany({ orderBy: { name: "asc" } });
    return list.map((u) => ({
      id: u.id,
      name: u.name,
      symbol: u.symbol,
      description: u.description || void 0
    }));
  }
  async getSuppliers() {
    const list = await this.prisma.supplier.findMany({ orderBy: { name: "asc" } });
    return list.map((s) => ({
      id: s.id,
      code: s.code,
      name: s.name,
      contactName: s.contactName || "",
      email: s.email || "",
      phone: s.phone || "",
      address: s.address || "",
      city: s.city || "",
      rating: s.rating,
      isActive: s.isActive,
      createdAt: s.createdAt.toISOString()
    }));
  }
  // --- Warehouses ---
  async getWarehouses() {
    const list = await this.prisma.warehouse.findMany({ orderBy: { name: "asc" } });
    return list.map((w) => ({
      id: w.id,
      code: w.code,
      name: w.name,
      branch: w.branch,
      address: w.address,
      capacityCbm: w.capacityCbm,
      managerId: w.managerId || void 0,
      isActive: w.isActive,
      createdAt: w.createdAt.toISOString()
    }));
  }
  async createWarehouse(input) {
    const id = `wh-${input.code.toLowerCase().replace(/[^a-z0-9]/g, "-")}`;
    const created = await this.prisma.warehouse.create({
      data: {
        id,
        code: input.code.toUpperCase(),
        name: input.name,
        branch: input.branch,
        address: input.address,
        capacityCbm: input.capacityCbm || 1e3,
        managerId: input.managerId || null,
        isActive: input.isActive ?? true
      }
    });
    return {
      id: created.id,
      code: created.code,
      name: created.name,
      branch: created.branch,
      address: created.address,
      capacityCbm: created.capacityCbm,
      managerId: created.managerId || void 0,
      isActive: created.isActive,
      createdAt: created.createdAt.toISOString()
    };
  }
  // --- Items & Inventory ---
  async getItems(options = {}) {
    const page = options.page || 1;
    const limit = options.limit || 50;
    const skip = (page - 1) * limit;
    const where = {};
    if (options.search) {
      where.OR = [
        { name: { contains: options.search } },
        { sku: { contains: options.search } },
        { barcode: { contains: options.search } }
      ];
    }
    if (options.categoryId) {
      where.categoryId = options.categoryId;
    }
    if (options.itemType) {
      where.itemType = options.itemType;
    }
    const [total, rows] = await Promise.all([
      this.prisma.item.count({ where }),
      this.prisma.item.findMany({
        where,
        skip,
        take: limit,
        include: {
          category: true,
          unit: true,
          supplier: true,
          stockBalances: true
        },
        orderBy: { updatedAt: "desc" }
      })
    ]);
    const items = rows.map((r) => ({
      id: r.id,
      sku: r.sku,
      barcode: r.barcode || "",
      name: r.name,
      description: r.description || "",
      categoryId: r.categoryId,
      categoryName: r.category?.name,
      unitId: r.unitId,
      unitSymbol: r.unit?.symbol,
      supplierId: r.supplierId || void 0,
      supplierName: r.supplier?.name,
      itemType: r.itemType,
      currentStock: r.currentStock,
      minStock: r.minStock,
      maxStock: r.maxStock,
      reorderPoint: r.reorderPoint,
      safetyStock: r.safetyStock,
      unitCost: Number(r.unitCost),
      unitPrice: Number(r.unitPrice),
      specifications: r.specifications || {},
      imageUrl: r.imageUrl || void 0,
      isActive: r.isActive,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
      stockBalances: r.stockBalances.map((sb) => ({
        id: sb.id,
        itemId: sb.itemId,
        warehouseId: sb.warehouseId,
        quantity: sb.quantity,
        reservedQty: sb.reservedQty,
        updatedAt: sb.updatedAt.toISOString()
      }))
    }));
    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1
    };
  }
  async getItemById(id) {
    const r = await this.prisma.item.findUnique({
      where: { id },
      include: {
        category: true,
        unit: true,
        supplier: true,
        stockBalances: {
          include: {
            warehouse: true
          }
        }
      }
    });
    if (!r) return null;
    return {
      id: r.id,
      sku: r.sku,
      barcode: r.barcode || "",
      name: r.name,
      description: r.description || "",
      categoryId: r.categoryId,
      categoryName: r.category?.name,
      unitId: r.unitId,
      unitSymbol: r.unit?.symbol,
      supplierId: r.supplierId || void 0,
      supplierName: r.supplier?.name,
      itemType: r.itemType,
      currentStock: r.currentStock,
      minStock: r.minStock,
      maxStock: r.maxStock,
      reorderPoint: r.reorderPoint,
      safetyStock: r.safetyStock,
      unitCost: Number(r.unitCost),
      unitPrice: Number(r.unitPrice),
      specifications: r.specifications || {},
      imageUrl: r.imageUrl || void 0,
      isActive: r.isActive,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
      stockBalances: r.stockBalances.map((sb) => ({
        id: sb.id,
        itemId: sb.itemId,
        warehouseId: sb.warehouseId,
        warehouseName: sb.warehouse?.name,
        quantity: sb.quantity,
        reservedQty: sb.reservedQty,
        updatedAt: sb.updatedAt.toISOString()
      }))
    };
  }
  async createItem(input) {
    const id = `itm-${input.sku.toLowerCase().replace(/[^a-z0-9]/g, "-")}`;
    const warehouses = await this.prisma.warehouse.findMany({ select: { id: true } });
    const created = await this.prisma.item.create({
      data: {
        id,
        sku: input.sku.toUpperCase(),
        barcode: input.barcode || null,
        name: input.name,
        description: input.description || null,
        categoryId: input.categoryId,
        unitId: input.unitId,
        supplierId: input.supplierId || null,
        itemType: input.itemType || "CONSUMABLE",
        currentStock: input.currentStock || 0,
        minStock: input.minStock || 10,
        maxStock: input.maxStock || 500,
        reorderPoint: input.reorderPoint || 20,
        safetyStock: input.safetyStock || 5,
        unitCost: input.unitCost || 0,
        unitPrice: input.unitPrice || 0,
        specifications: input.specifications || {},
        imageUrl: input.imageUrl || null,
        isActive: input.isActive ?? true,
        stockBalances: {
          create: warehouses.map((wh, idx) => ({
            id: `sb-${id}-${wh.id}`,
            warehouseId: wh.id,
            quantity: idx === 0 ? input.currentStock || 0 : 0,
            reservedQty: 0
          }))
        }
      },
      include: {
        category: true,
        unit: true,
        supplier: true,
        stockBalances: true
      }
    });
    return {
      id: created.id,
      sku: created.sku,
      barcode: created.barcode || "",
      name: created.name,
      description: created.description || "",
      categoryId: created.categoryId,
      categoryName: created.category?.name,
      unitId: created.unitId,
      unitSymbol: created.unit?.symbol,
      supplierId: created.supplierId || void 0,
      supplierName: created.supplier?.name,
      itemType: created.itemType,
      currentStock: created.currentStock,
      minStock: created.minStock,
      maxStock: created.maxStock,
      reorderPoint: created.reorderPoint,
      safetyStock: created.safetyStock,
      unitCost: Number(created.unitCost),
      unitPrice: Number(created.unitPrice),
      specifications: created.specifications || {},
      imageUrl: created.imageUrl || void 0,
      isActive: created.isActive,
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
      stockBalances: created.stockBalances.map((sb) => ({
        id: sb.id,
        itemId: sb.itemId,
        warehouseId: sb.warehouseId,
        quantity: sb.quantity,
        reservedQty: sb.reservedQty,
        updatedAt: sb.updatedAt.toISOString()
      }))
    };
  }
  async updateItem(id, updates) {
    const updated = await this.prisma.item.update({
      where: { id },
      data: {
        ...updates.name ? { name: updates.name } : {},
        ...updates.description !== void 0 ? { description: updates.description } : {},
        ...updates.barcode !== void 0 ? { barcode: updates.barcode } : {},
        ...updates.minStock !== void 0 ? { minStock: updates.minStock } : {},
        ...updates.maxStock !== void 0 ? { maxStock: updates.maxStock } : {},
        ...updates.reorderPoint !== void 0 ? { reorderPoint: updates.reorderPoint } : {},
        ...updates.safetyStock !== void 0 ? { safetyStock: updates.safetyStock } : {},
        ...updates.unitCost !== void 0 ? { unitCost: updates.unitCost } : {},
        ...updates.unitPrice !== void 0 ? { unitPrice: updates.unitPrice } : {},
        ...updates.specifications !== void 0 ? { specifications: updates.specifications } : {},
        ...updates.isActive !== void 0 ? { isActive: updates.isActive } : {}
      },
      include: {
        category: true,
        unit: true,
        supplier: true,
        stockBalances: true
      }
    });
    return {
      id: updated.id,
      sku: updated.sku,
      barcode: updated.barcode || "",
      name: updated.name,
      description: updated.description || "",
      categoryId: updated.categoryId,
      categoryName: updated.category?.name,
      unitId: updated.unitId,
      unitSymbol: updated.unit?.symbol,
      supplierId: updated.supplierId || void 0,
      supplierName: updated.supplier?.name,
      itemType: updated.itemType,
      currentStock: updated.currentStock,
      minStock: updated.minStock,
      maxStock: updated.maxStock,
      reorderPoint: updated.reorderPoint,
      safetyStock: updated.safetyStock,
      unitCost: Number(updated.unitCost),
      unitPrice: Number(updated.unitPrice),
      specifications: updated.specifications || {},
      imageUrl: updated.imageUrl || void 0,
      isActive: updated.isActive,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString()
    };
  }
  // --- ATOMIC STOCK MUTATIONS (Goods In, Out, Transfer) ---
  async executeStockMovement(input) {
    if (input.idempotencyKey) {
      const existing = await this.prisma.stockMovement.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
        include: { details: true }
      });
      if (existing) {
        return this.mapStockMovement(existing);
      }
    }
    return await this.prisma.$transaction(async (tx) => {
      if (input.type === "IN" && !input.targetWarehouseId) {
        throw new Error("Gudang tujuan wajib ditentukan untuk transaksi barang masuk (IN).");
      }
      if (input.type === "OUT" && !input.sourceWarehouseId) {
        throw new Error("Gudang asal wajib ditentukan untuk transaksi barang keluar (OUT).");
      }
      if (input.type === "TRANSFER" && (!input.sourceWarehouseId || !input.targetWarehouseId)) {
        throw new Error("Gudang asal dan tujuan wajib ditentukan untuk mutasi transfer.");
      }
      if (input.type === "TRANSFER" && input.sourceWarehouseId === input.targetWarehouseId) {
        throw new Error("Gudang asal dan tujuan tidak boleh sama.");
      }
      const movementId = `mov-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
      const movementNumber = `MOV-${(/* @__PURE__ */ new Date()).toISOString().slice(0, 7).replace("-", "")}-${Math.floor(1e3 + Math.random() * 9e3)}`;
      for (const d of input.details) {
        const item = await tx.item.findUnique({
          where: { id: d.itemId },
          select: { id: true, name: true, sku: true, currentStock: true, unitCost: true }
        });
        if (!item) {
          throw new Error(`Item ID "${d.itemId}" tidak ditemukan di database.`);
        }
        const quantity = d.quantity;
        if (quantity <= 0) {
          throw new Error(`Kuantitas untuk "${item.name}" harus lebih besar dari 0.`);
        }
        if (input.type === "OUT") {
          const sourceBal = await tx.stockBalance.findUnique({
            where: {
              itemId_warehouseId: {
                itemId: d.itemId,
                warehouseId: input.sourceWarehouseId
              }
            }
          });
          const availableQty = sourceBal ? sourceBal.quantity - sourceBal.reservedQty : 0;
          if (availableQty < quantity) {
            throw new Error(`Stok tidak mencukupi untuk item "${item.name}" (${item.sku}). Tersedia: ${availableQty}, Diminta: ${quantity}`);
          }
          await tx.stockBalance.update({
            where: { id: sourceBal.id },
            data: { quantity: { decrement: quantity } }
          });
          await tx.item.update({
            where: { id: item.id },
            data: { currentStock: { decrement: quantity } }
          });
        } else if (input.type === "IN") {
          await tx.stockBalance.upsert({
            where: {
              itemId_warehouseId: {
                itemId: d.itemId,
                warehouseId: input.targetWarehouseId
              }
            },
            create: {
              id: `sb-${d.itemId}-${input.targetWarehouseId}`,
              itemId: d.itemId,
              warehouseId: input.targetWarehouseId,
              quantity,
              reservedQty: 0
            },
            update: {
              quantity: { increment: quantity }
            }
          });
          await tx.item.update({
            where: { id: item.id },
            data: { currentStock: { increment: quantity } }
          });
        } else if (input.type === "TRANSFER") {
          const sourceBal = await tx.stockBalance.findUnique({
            where: {
              itemId_warehouseId: {
                itemId: d.itemId,
                warehouseId: input.sourceWarehouseId
              }
            }
          });
          const availableQty = sourceBal ? sourceBal.quantity - sourceBal.reservedQty : 0;
          if (availableQty < quantity) {
            throw new Error(`Stok tidak mencukupi di gudang asal untuk item "${item.name}". Tersedia: ${availableQty}, Diminta: ${quantity}`);
          }
          await tx.stockBalance.update({
            where: { id: sourceBal.id },
            data: { quantity: { decrement: quantity } }
          });
          await tx.stockBalance.upsert({
            where: {
              itemId_warehouseId: {
                itemId: d.itemId,
                warehouseId: input.targetWarehouseId
              }
            },
            create: {
              id: `sb-${d.itemId}-${input.targetWarehouseId}`,
              itemId: d.itemId,
              warehouseId: input.targetWarehouseId,
              quantity,
              reservedQty: 0
            },
            update: {
              quantity: { increment: quantity }
            }
          });
        }
      }
      const createdMovement = await tx.stockMovement.create({
        data: {
          id: movementId,
          movementNumber,
          type: input.type,
          status: "COMPLETED",
          sourceWarehouseId: input.sourceWarehouseId || null,
          targetWarehouseId: input.targetWarehouseId || null,
          supplierId: input.supplierId || null,
          referenceDoc: input.referenceDoc || null,
          idempotencyKey: input.idempotencyKey || null,
          notes: input.notes || null,
          createdByUserId: input.createdByUserId,
          details: {
            create: input.details.map((d, idx) => ({
              id: `smd-${movementId}-${idx}`,
              itemId: d.itemId,
              quantity: d.quantity,
              unitCost: d.unitCost ?? 0,
              subtotal: d.quantity * (d.unitCost ?? 0),
              notes: d.notes || null
            }))
          }
        },
        include: {
          details: true,
          sourceWarehouse: true,
          targetWarehouse: true,
          createdByUser: true
        }
      });
      await tx.auditLog.create({
        data: {
          id: `aud-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          action: `STOCK_${input.type}`,
          entity: "StockMovement",
          entityId: createdMovement.id,
          userId: input.createdByUserId,
          userName: createdMovement.createdByUser?.name || "System User",
          detailsJson: {
            movementNumber,
            type: input.type,
            sourceWarehouse: createdMovement.sourceWarehouse?.name,
            targetWarehouse: createdMovement.targetWarehouse?.name,
            itemCount: input.details.length
          }
        }
      });
      return this.mapStockMovement(createdMovement);
    });
  }
  async getStockMovements(options = {}) {
    const page = options.page || 1;
    const limit = options.limit || 50;
    const skip = (page - 1) * limit;
    const where = {};
    if (options.type) where.type = options.type;
    if (options.warehouseId) {
      where.OR = [
        { sourceWarehouseId: options.warehouseId },
        { targetWarehouseId: options.warehouseId }
      ];
    }
    const [total, rows] = await Promise.all([
      this.prisma.stockMovement.count({ where }),
      this.prisma.stockMovement.findMany({
        where,
        skip,
        take: limit,
        include: {
          sourceWarehouse: true,
          targetWarehouse: true,
          supplier: true,
          createdByUser: true,
          approvedByUser: true,
          details: {
            include: {
              item: true
            }
          }
        },
        orderBy: { createdAt: "desc" }
      })
    ]);
    return {
      movements: rows.map((r) => this.mapStockMovement(r)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1
    };
  }
  // --- Serialized Assets ---
  async getAssetUnits(filter = {}) {
    const where = {};
    if (filter.status) where.status = filter.status;
    if (filter.condition) where.condition = filter.condition;
    if (filter.warehouseId) where.warehouseId = filter.warehouseId;
    if (filter.assignedToUserId) where.assignedToUserId = filter.assignedToUserId;
    if (filter.search) {
      where.OR = [
        { assetTag: { contains: filter.search } },
        { serialNumber: { contains: filter.search } }
      ];
    }
    const rows = await this.prisma.assetUnit.findMany({
      where,
      include: {
        item: true,
        warehouse: true,
        assignedToUser: true
      },
      orderBy: { createdAt: "desc" }
    });
    return rows.map((r) => ({
      id: r.id,
      assetTag: r.assetTag,
      serialNumber: r.serialNumber,
      itemId: r.itemId,
      itemName: r.item?.name,
      itemSku: r.item?.sku,
      warehouseId: r.warehouseId,
      warehouseName: r.warehouse?.name,
      status: r.status,
      condition: r.condition,
      assignedToUserId: r.assignedToUserId || void 0,
      assignedToUserName: r.assignedToUser?.name,
      department: r.department || void 0,
      purchaseDate: r.purchaseDate ? r.purchaseDate.toISOString() : void 0,
      purchaseCost: Number(r.purchaseCost),
      warrantyExpiry: r.warrantyExpiry ? r.warrantyExpiry.toISOString() : void 0,
      notes: r.notes || void 0,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString()
    }));
  }
  async getAssetById(id) {
    const r = await this.prisma.assetUnit.findUnique({
      where: { id },
      include: {
        item: true,
        warehouse: true,
        assignedToUser: true,
        assignments: {
          include: {
            assignedToUser: true,
            assignedByUser: true
          },
          orderBy: { assignedAt: "desc" }
        }
      }
    });
    if (!r) return null;
    return {
      id: r.id,
      assetTag: r.assetTag,
      serialNumber: r.serialNumber,
      itemId: r.itemId,
      itemName: r.item?.name,
      itemSku: r.item?.sku,
      warehouseId: r.warehouseId,
      warehouseName: r.warehouse?.name,
      status: r.status,
      condition: r.condition,
      assignedToUserId: r.assignedToUserId || void 0,
      assignedToUserName: r.assignedToUser?.name,
      department: r.department || void 0,
      purchaseDate: r.purchaseDate ? r.purchaseDate.toISOString() : void 0,
      purchaseCost: Number(r.purchaseCost),
      warrantyExpiry: r.warrantyExpiry ? r.warrantyExpiry.toISOString() : void 0,
      notes: r.notes || void 0,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString()
    };
  }
  async createAssetUnit(input) {
    const item = await this.prisma.item.findUnique({ where: { id: input.itemId } });
    if (!item) throw new Error("Item tidak ditemukan.");
    if (item.itemType !== "SERIALIZED_ASSET") {
      throw new Error(`Item ${item.name} adalah item CONSUMABLE dan tidak dapat didaftarkan sebagai unit aset bernomor seri.`);
    }
    const id = `ast-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    const created = await this.prisma.assetUnit.create({
      data: {
        id,
        assetTag: input.assetTag,
        serialNumber: input.serialNumber,
        itemId: input.itemId,
        warehouseId: input.warehouseId,
        status: input.status || "AVAILABLE",
        condition: input.condition || "GOOD",
        purchaseCost: input.purchaseCost || 0,
        purchaseDate: input.purchaseDate ? new Date(input.purchaseDate) : null,
        warrantyExpiry: input.warrantyExpiry ? new Date(input.warrantyExpiry) : null,
        notes: input.notes || null
      },
      include: {
        item: true,
        warehouse: true
      }
    });
    return {
      id: created.id,
      assetTag: created.assetTag,
      serialNumber: created.serialNumber,
      itemId: created.itemId,
      itemName: created.item?.name,
      itemSku: created.item?.sku,
      warehouseId: created.warehouseId,
      warehouseName: created.warehouse?.name,
      status: created.status,
      condition: created.condition,
      purchaseCost: Number(created.purchaseCost),
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString()
    };
  }
  async updateAssetStatus(id, updates) {
    const updated = await this.prisma.assetUnit.update({
      where: { id },
      data: {
        status: updates.status,
        ...updates.condition ? { condition: updates.condition } : {},
        assignedToUserId: updates.assignedToUserId || null,
        department: updates.department || null,
        notes: updates.notes || null
      },
      include: {
        item: true,
        warehouse: true,
        assignedToUser: true
      }
    });
    return {
      id: updated.id,
      assetTag: updated.assetTag,
      serialNumber: updated.serialNumber,
      itemId: updated.itemId,
      itemName: updated.item?.name,
      itemSku: updated.item?.sku,
      warehouseId: updated.warehouseId,
      warehouseName: updated.warehouse?.name,
      status: updated.status,
      condition: updated.condition,
      assignedToUserId: updated.assignedToUserId || void 0,
      assignedToUserName: updated.assignedToUser?.name,
      department: updated.department || void 0,
      purchaseCost: Number(updated.purchaseCost),
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString()
    };
  }
  // --- Stock Opnames ---
  async getStockOpnames() {
    const list = await this.prisma.stockOpname.findMany({
      include: {
        warehouse: true,
        details: true
      },
      orderBy: { createdAt: "desc" }
    });
    return list.map((o) => ({
      id: o.id,
      opnameNumber: o.opnameNumber,
      warehouseId: o.warehouseId,
      warehouseName: o.warehouse?.name,
      scheduledDate: o.scheduledDate.toISOString().slice(0, 10),
      status: o.status,
      notes: o.notes || void 0,
      createdAt: o.createdAt.toISOString(),
      totalItemsCount: o.details.length,
      discrepancyCount: o.details.filter((d) => d.difference !== 0).length,
      discrepancyValueTotal: o.details.reduce((sum, d) => sum + Number(d.discrepancyValue), 0),
      details: o.details.map((d) => ({
        id: d.id,
        opnameId: d.opnameId,
        itemId: d.itemId,
        itemSku: "",
        itemName: "",
        systemStock: d.systemStock,
        physicalStock: d.physicalStock,
        difference: d.difference,
        unitCost: Number(d.unitCost),
        discrepancyValue: Number(d.discrepancyValue),
        notes: d.notes || void 0
      }))
    }));
  }
  async createStockOpname(input) {
    const opnameId = `opn-${Date.now()}`;
    const opnameNumber = `OPN-${(/* @__PURE__ */ new Date()).toISOString().slice(0, 7).replace("-", "")}-${Math.floor(10 + Math.random() * 90)}`;
    const created = await this.prisma.stockOpname.create({
      data: {
        id: opnameId,
        opnameNumber,
        warehouseId: input.warehouseId,
        scheduledDate: new Date(input.scheduledDate),
        status: input.status || "IN_PROGRESS",
        notes: input.notes || null,
        details: {
          create: (input.details || []).map((d, idx) => ({
            id: `opnd-${opnameId}-${idx}`,
            itemId: d.itemId,
            systemStock: d.systemStock,
            physicalStock: d.physicalStock,
            difference: d.difference,
            unitCost: d.unitCost,
            discrepancyValue: d.discrepancyValue,
            notes: d.notes || null
          }))
        }
      },
      include: {
        warehouse: true,
        details: true
      }
    });
    return {
      id: created.id,
      opnameNumber: created.opnameNumber,
      warehouseId: created.warehouseId,
      warehouseName: created.warehouse?.name,
      scheduledDate: created.scheduledDate.toISOString().slice(0, 10),
      status: created.status,
      notes: created.notes || void 0,
      createdAt: created.createdAt.toISOString(),
      details: input.details
    };
  }
  // --- Item Requests ---
  async getItemRequests() {
    const list = await this.prisma.itemRequest.findMany({
      include: {
        requestedByUser: true,
        approvedByUser: true,
        details: {
          include: {
            item: true
          }
        }
      },
      orderBy: { createdAt: "desc" }
    });
    return list.map((r) => ({
      id: r.id,
      requestNumber: r.requestNumber,
      department: r.department,
      urgency: r.urgency,
      status: r.status,
      reason: r.reason,
      requestedByUserId: r.requestedByUserId,
      requestedByUserName: r.requestedByUser?.name,
      approvedByUserId: r.approvedByUserId || void 0,
      approvedByUserName: r.approvedByUser?.name,
      approvedAt: r.approvedAt ? r.approvedAt.toISOString() : void 0,
      rejectionReason: r.rejectionReason || void 0,
      createdAt: r.createdAt.toISOString(),
      details: r.details.map((d) => ({
        id: d.id,
        requestId: d.requestId,
        itemId: d.itemId,
        itemSku: d.item?.sku || "",
        itemName: d.item?.name || "",
        requestedQty: d.requestedQty,
        approvedQty: d.approvedQty || void 0
      }))
    }));
  }
  async createItemRequest(input) {
    const id = `req-${Date.now()}`;
    const requestNumber = `REQ-${(/* @__PURE__ */ new Date()).toISOString().slice(0, 7).replace("-", "")}-${Math.floor(100 + Math.random() * 900)}`;
    const created = await this.prisma.itemRequest.create({
      data: {
        id,
        requestNumber,
        department: input.department,
        urgency: input.urgency || "NORMAL",
        status: input.status || "PENDING",
        reason: input.reason,
        requestedByUserId: input.requestedByUserId,
        details: {
          create: input.details.map((d, idx) => ({
            id: `ird-${id}-${idx}`,
            itemId: d.itemId,
            requestedQty: d.requestedQty
          }))
        }
      },
      include: {
        requestedByUser: true,
        details: true
      }
    });
    return {
      id: created.id,
      requestNumber: created.requestNumber,
      department: created.department,
      urgency: created.urgency,
      status: created.status,
      reason: created.reason,
      requestedByUserId: created.requestedByUserId,
      requestedByName: created.requestedByUser?.name,
      createdAt: created.createdAt.toISOString(),
      details: input.details
    };
  }
  // --- Audit Logs ---
  async getAuditLogs(limit = 100) {
    const list = await this.prisma.auditLog.findMany({
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        user: true
      }
    });
    return list.map((l) => ({
      id: l.id,
      action: l.action,
      entity: l.entity,
      entityId: l.entityId || void 0,
      userId: l.userId || void 0,
      userName: l.userName || l.user?.name || "System",
      ipAddress: l.ipAddress || "127.0.0.1",
      detailsJson: l.detailsJson,
      createdAt: l.createdAt.toISOString()
    }));
  }
  async logAudit(entry) {
    const id = `aud-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    const created = await this.prisma.auditLog.create({
      data: {
        id,
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId || null,
        userId: entry.userId || null,
        userName: entry.userName || null,
        ipAddress: entry.ipAddress || "127.0.0.1",
        detailsJson: entry.detailsJson || null
      }
    });
    return {
      id: created.id,
      action: created.action,
      entity: created.entity,
      entityId: created.entityId || void 0,
      userId: created.userId || void 0,
      userName: created.userName || void 0,
      ipAddress: created.ipAddress || void 0,
      detailsJson: created.detailsJson,
      createdAt: created.createdAt.toISOString()
    };
  }
  mapStockMovement(r) {
    return {
      id: r.id,
      movementNumber: r.movementNumber,
      type: r.type,
      status: r.status,
      sourceWarehouseId: r.sourceWarehouseId || void 0,
      sourceWarehouseName: r.sourceWarehouse?.name,
      targetWarehouseId: r.targetWarehouseId || void 0,
      targetWarehouseName: r.targetWarehouse?.name,
      supplierId: r.supplierId || void 0,
      supplierName: r.supplier?.name,
      referenceDoc: r.referenceDoc || void 0,
      idempotencyKey: r.idempotencyKey || void 0,
      notes: r.notes || void 0,
      createdByUserId: r.createdByUserId,
      createdByName: r.createdByUser?.name || "Staff",
      approvedByUserId: r.approvedByUserId || void 0,
      approvedByName: r.approvedByUser?.name,
      createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : (/* @__PURE__ */ new Date()).toISOString(),
      details: (r.details || []).map((d) => ({
        id: d.id,
        movementId: d.movementId,
        itemId: d.itemId,
        itemSku: d.item?.sku || "",
        itemName: d.item?.name || "",
        quantity: d.quantity,
        unitCost: Number(d.unitCost || 0),
        subtotal: Number(d.subtotal || 0),
        notes: d.notes || void 0
      }))
    };
  }
};

// server/db/store.ts
import fs from "fs";
import path from "path";

// server/security/auth.ts
import crypto from "crypto";
var isProduction = process.env.NODE_ENV === "production";
var rawSecret = process.env.JWT_SECRET;
if (isProduction && (!rawSecret || rawSecret === "inventra_enterprise_secure_jwt_secret_key_2026")) {
  console.error("[CRITICAL SECURITY ERROR] In production, process.env.JWT_SECRET must be configured with a strong, unique secret key!");
}
var SECRET_KEY = rawSecret || "inventra_enterprise_secure_jwt_secret_key_2026";
function hashPassword(password) {
  if (!password || typeof password !== "string") {
    throw new Error("Password must be a non-empty string");
  }
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, salt, 1e4, 64, "sha512").toString("hex");
  return `${salt}:${hash}`;
}
function verifyPassword(password, storedHash) {
  try {
    if (!password || !storedHash) return false;
    const parts = storedHash.split(":");
    if (parts.length !== 2) return false;
    const [salt, key] = parts;
    if (!salt || !key) return false;
    let testHash = crypto.pbkdf2Sync(password, salt, 1e4, 64, "sha512").toString("hex");
    if (crypto.timingSafeEqual(Buffer.from(key, "hex"), Buffer.from(testHash, "hex"))) {
      return true;
    }
    testHash = crypto.pbkdf2Sync(password, salt, 1e3, 64, "sha512").toString("hex");
    return crypto.timingSafeEqual(Buffer.from(key, "hex"), Buffer.from(testHash, "hex"));
  } catch {
    return false;
  }
}
function signToken(payload) {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const exp = Math.floor(Date.now() / 1e3) + 60 * 60 * 24;
  const body = Buffer.from(JSON.stringify({ ...payload, exp })).toString("base64url");
  const signature = crypto.createHmac("sha256", SECRET_KEY).update(`${header}.${body}`).digest("base64url");
  return `${header}.${body}.${signature}`;
}
function verifyToken(token) {
  try {
    if (!token || typeof token !== "string") return null;
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [header, body, signature] = parts;
    const expectedSig = crypto.createHmac("sha256", SECRET_KEY).update(`${header}.${body}`).digest("base64url");
    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expectedSig);
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return null;
    }
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1e3)) {
      return null;
    }
    if (!payload.userId || !payload.role) {
      return null;
    }
    return {
      userId: payload.userId,
      email: payload.email,
      name: payload.name,
      role: payload.role,
      department: payload.department || ""
    };
  } catch {
    return null;
  }
}
var ROLE_PERMISSIONS = {
  SUPER_ADMIN: [
    "items:read",
    "items:create",
    "items:update",
    "items:delete",
    "warehouses:read",
    "warehouses:create",
    "warehouses:update",
    "movements:read",
    "movements:in",
    "movements:out",
    "movements:transfer",
    "movements:approve",
    "assets:read",
    "assets:create",
    "assets:assign",
    "assets:maintain",
    "opname:read",
    "opname:create",
    "opname:adjust",
    "requests:read",
    "requests:create",
    "requests:approve",
    "reports:read",
    "reports:export",
    "audit:read",
    "users:read",
    "users:manage",
    "settings:manage"
  ],
  WAREHOUSE_MANAGER: [
    "items:read",
    "items:create",
    "items:update",
    "warehouses:read",
    "movements:read",
    "movements:in",
    "movements:out",
    "movements:transfer",
    "movements:approve",
    "assets:read",
    "assets:create",
    "assets:assign",
    "opname:read",
    "opname:create",
    "opname:adjust",
    "requests:read",
    "requests:approve",
    "reports:read",
    "reports:export",
    "audit:read"
  ],
  INVENTORY_STAFF: [
    "items:read",
    "warehouses:read",
    "movements:read",
    "movements:in",
    "movements:out",
    "assets:read",
    "opname:read",
    "opname:create",
    "requests:read",
    "requests:create",
    "reports:read"
  ],
  ASSET_CUSTODIAN: [
    "items:read",
    "warehouses:read",
    "assets:read",
    "assets:assign",
    "assets:maintain",
    "requests:read",
    "requests:create",
    "reports:read"
  ],
  AUDITOR: [
    "items:read",
    "warehouses:read",
    "movements:read",
    "assets:read",
    "opname:read",
    "requests:read",
    "reports:read",
    "reports:export",
    "audit:read"
  ]
};
function hasPermission(role, permission) {
  const permissions = ROLE_PERMISSIONS[role] || [];
  return permissions.includes(permission);
}
function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.startsWith("Bearer ") ? authHeader.substring(7) : null;
  if (!token) {
    if (!isProduction && process.env.ALLOW_DEMO_HEADER_BYPASS === "true") {
      const demoRole = req.headers["x-demo-role"];
      if (demoRole && ROLE_PERMISSIONS[demoRole]) {
        console.warn(`[SECURITY WARNING] Allowing dev demo bypass for role: ${demoRole}`);
        req.user = {
          userId: `demo-${demoRole.toLowerCase()}`,
          email: `${demoRole.toLowerCase()}@nga-inventra.com`,
          name: `Demo ${demoRole.replace("_", " ")}`,
          role: demoRole,
          department: "Operations"
        };
        return next();
      }
    }
    res.status(401).json({ error: "Akses ditolak. Token otentikasi tidak ditemukan." });
    return;
  }
  const payload = verifyToken(token);
  if (!payload) {
    res.status(403).json({ error: "Token otentikasi tidak valid atau telah kedaluwarsa." });
    return;
  }
  req.user = payload;
  next();
}
function requirePermission(permission) {
  return (req, res, next) => {
    if (!req.user) {
      res.status(401).json({ error: "Akses ditolak. Pengguna belum terautentikasi." });
      return;
    }
    if (!hasPermission(req.user.role, permission)) {
      res.status(403).json({
        error: `Akses ditolak. Peran '${req.user.role}' tidak memiliki izin '${permission}'.`,
        code: "FORBIDDEN_PERMISSION"
      });
      return;
    }
    next();
  };
}

// server/db/seedData.ts
function getInitialSeedData() {
  const users = [
    {
      id: "usr-admin-01",
      email: "admin@nga-inventra.com",
      passwordHash: hashPassword("AdminSecurePass2026!"),
      name: "Budi Pratama (Super Admin)",
      role: "SUPER_ADMIN",
      department: "Executive Operations",
      avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150",
      isActive: true,
      createdAt: "2026-01-10T08:00:00.000Z",
      updatedAt: "2026-01-10T08:00:00.000Z"
    },
    {
      id: "usr-mgr-01",
      email: "manager@nga-inventra.com",
      passwordHash: hashPassword("ManagerPass2026!"),
      name: "Dewi Kartika (Warehouse Mgr)",
      role: "WAREHOUSE_MANAGER",
      department: "Supply Chain & Logistics",
      avatarUrl: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150",
      isActive: true,
      createdAt: "2026-01-11T09:00:00.000Z",
      updatedAt: "2026-01-11T09:00:00.000Z"
    },
    {
      id: "usr-staff-01",
      email: "staff@nga-inventra.com",
      passwordHash: hashPassword("StaffPass2026!"),
      name: "Rian Hidayat (Inventory Staff)",
      role: "INVENTORY_STAFF",
      department: "Central Fulfillment",
      avatarUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150",
      isActive: true,
      createdAt: "2026-01-12T10:00:00.000Z",
      updatedAt: "2026-01-12T10:00:00.000Z"
    },
    {
      id: "usr-cust-01",
      email: "custodian@nga-inventra.com",
      passwordHash: hashPassword("CustodianPass2026!"),
      name: "Siti Rahma (IT Custodian)",
      role: "ASSET_CUSTODIAN",
      department: "Information Technology",
      avatarUrl: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150",
      isActive: true,
      createdAt: "2026-01-14T11:00:00.000Z",
      updatedAt: "2026-01-14T11:00:00.000Z"
    },
    {
      id: "usr-audit-01",
      email: "auditor@nga-inventra.com",
      passwordHash: hashPassword("AuditorPass2026!"),
      name: "Hendra Gunawan (Internal Auditor)",
      role: "AUDITOR",
      department: "Compliance & Audit",
      avatarUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150",
      isActive: true,
      createdAt: "2026-01-15T12:00:00.000Z",
      updatedAt: "2026-01-15T12:00:00.000Z"
    }
  ];
  const categories = [
    { id: "cat-it-hw", code: "IT-HW", name: "IT Hardware & Peripherals", description: "Perangkat keras komputer, server, dan aksesoris digital", createdAt: "2026-01-01T00:00:00.000Z" },
    { id: "cat-net", code: "NET-EQ", name: "Networking Equipment", description: "Switch, router, access point, dan kabel jaringan", createdAt: "2026-01-01T00:00:00.000Z" },
    { id: "cat-mhe", code: "MHE-WH", name: "Material Handling Equipment", description: "Forklift, pallet jack, racking equipment gudang", createdAt: "2026-01-01T00:00:00.000Z" },
    { id: "cat-pck", code: "PCK-MAT", name: "Packaging & Consumables", description: "Kardus, bubble wrap, stretch film, thermal roll", createdAt: "2026-01-01T00:00:00.000Z" },
    { id: "cat-off", code: "OFF-SUP", name: "Office Supplies & Stationeries", description: "Alat tulis kantor dan perlengkapan administrasi", createdAt: "2026-01-01T00:00:00.000Z" },
    { id: "cat-sft", code: "SFT-PPE", name: "Safety & PPE", description: "Helm keselamatan, rompi reflektor, sarung tangan kerja", createdAt: "2026-01-01T00:00:00.000Z" }
  ];
  const units = [
    { id: "u-pcs", name: "Pieces", symbol: "PCS", description: "Satuan per buah atau unit" },
    { id: "u-box", name: "Box", symbol: "BOX", description: "Kemasan kotak berisi multi item" },
    { id: "u-roll", name: "Roll", symbol: "ROLL", description: "Satuan gulungan" },
    { id: "u-pack", name: "Pack", symbol: "PACK", description: "Paket bundling" },
    { id: "u-set", name: "Set", symbol: "SET", description: "Satu set perlengkapan lengkap" }
  ];
  const suppliers = [
    {
      id: "sup-01",
      code: "SUP-ASTRA",
      name: "PT Mitra Solusi Teknologi",
      contactName: "Agus Wijaya",
      email: "sales@mitratech.co.id",
      phone: "+62-21-555-8891",
      address: "Kawasan Industri Pulogadung Blok B No. 4",
      city: "Jakarta Timur",
      rating: 4.9,
      isActive: true,
      createdAt: "2026-01-02T00:00:00.000Z"
    },
    {
      id: "sup-02",
      code: "SUP-LOGIS",
      name: "PT Samudera Logistik Sarana",
      contactName: "Ferry Santoso",
      email: "order@samuderalogistik.id",
      phone: "+62-31-778-1200",
      address: "Jl. Tanjung Perak Barat No. 88",
      city: "Surabaya",
      rating: 4.8,
      isActive: true,
      createdAt: "2026-01-03T00:00:00.000Z"
    },
    {
      id: "sup-03",
      code: "SUP-PACK",
      name: "CV Prima Multi Packaging",
      contactName: "Linda Hartanto",
      email: "inquiry@primapack.com",
      phone: "+62-21-889-4321",
      address: "Jl. Raya Narogong Km 12",
      city: "Bekasi",
      rating: 4.7,
      isActive: true,
      createdAt: "2026-01-04T00:00:00.000Z"
    }
  ];
  const warehouses = [
    {
      id: "wh-jkt-main",
      code: "WH-JKT-01",
      name: "Central Distribution Center (CDC)",
      branch: "Jakarta Hub",
      address: "Kawasan Pergudangan Marunda Center Kav. 12, Jakarta Utara",
      capacityCbm: 15e3,
      managerId: "usr-mgr-01",
      managerName: "Dewi Kartika",
      isActive: true,
      createdAt: "2026-01-01T00:00:00.000Z"
    },
    {
      id: "wh-sby-hub",
      code: "WH-SBY-02",
      name: "East Java Regional Fulfillment",
      branch: "Surabaya Hub",
      address: "Jl. Rungkut Industri Raya No. 45, Surabaya",
      capacityCbm: 8500,
      managerId: "usr-mgr-01",
      managerName: "Dewi Kartika",
      isActive: true,
      createdAt: "2026-01-01T00:00:00.000Z"
    },
    {
      id: "wh-bpp-hub",
      code: "WH-BPP-03",
      name: "Borneo Logistics Depot",
      branch: "Balikpapan Branch",
      address: "Jl. Mulawarman Batakan Km 14, Balikpapan",
      capacityCbm: 5e3,
      managerId: "usr-mgr-01",
      managerName: "Dewi Kartika",
      isActive: true,
      createdAt: "2026-01-05T00:00:00.000Z"
    },
    {
      id: "wh-med-hub",
      code: "WH-MED-04",
      name: "Sumatra Regional Depot",
      branch: "Medan Branch",
      address: "Kawasan Industri Medan (KIM) II, Deli Serdang",
      capacityCbm: 6e3,
      managerId: "usr-mgr-01",
      managerName: "Dewi Kartika",
      isActive: true,
      createdAt: "2026-01-05T00:00:00.000Z"
    }
  ];
  const locations = [
    { id: "loc-01", warehouseId: "wh-jkt-main", code: "A1-R01-S01", aisle: "A1", rack: "R01", shelf: "S01", bin: "B01" },
    { id: "loc-02", warehouseId: "wh-jkt-main", code: "A1-R01-S02", aisle: "A1", rack: "R01", shelf: "S02", bin: "B02" },
    { id: "loc-03", warehouseId: "wh-jkt-main", code: "B2-R04-S01", aisle: "B2", rack: "R04", shelf: "S01", bin: "B01" },
    { id: "loc-04", warehouseId: "wh-sby-hub", code: "S1-R02-S01", aisle: "S1", rack: "R02", shelf: "S01", bin: "B01" }
  ];
  const items = [
    // Consumable items
    {
      id: "itm-cbl-cat6",
      sku: "SKU-CON-NET-001",
      barcode: "899100200301",
      name: "Kabel UTP Belden Cat6 305M Roll",
      description: "Kabel jaringan Gigabit Ethernet UTP Cat6 kualitas industri",
      categoryId: "cat-net",
      categoryName: "Networking Equipment",
      unitId: "u-roll",
      unitSymbol: "ROLL",
      supplierId: "sup-01",
      supplierName: "PT Mitra Solusi Teknologi",
      itemType: "CONSUMABLE",
      currentStock: 48,
      minStock: 15,
      maxStock: 100,
      reorderPoint: 25,
      safetyStock: 10,
      unitCost: 185e4,
      unitPrice: 22e5,
      specifications: { "Standar": "ANSI/TIA-568-C.2", "Panjang": "305 Meter", "Kecepatan": "1000 Mbps" },
      isActive: true,
      createdAt: "2026-01-10T00:00:00.000Z",
      updatedAt: "2026-10-15T00:00:00.000Z"
    },
    {
      id: "itm-thm-paper",
      sku: "SKU-CON-PCK-002",
      barcode: "899100200302",
      name: "Kertas Thermal Roll 80x80mm Coreless",
      description: "Kertas struk kasir dan barcode printer high sensitivity",
      categoryId: "cat-pck",
      categoryName: "Packaging & Consumables",
      unitId: "u-roll",
      unitSymbol: "ROLL",
      supplierId: "sup-03",
      supplierName: "CV Prima Multi Packaging",
      itemType: "CONSUMABLE",
      currentStock: 12,
      // LOW STOCK! Below minStock 20!
      minStock: 20,
      maxStock: 200,
      reorderPoint: 35,
      safetyStock: 15,
      unitCost: 14500,
      unitPrice: 19e3,
      specifications: { "Ukuran": "80mm x 80mm", "Bahan": "Thermal Paper 65gsm" },
      isActive: true,
      createdAt: "2026-01-10T00:00:00.000Z",
      updatedAt: "2026-10-16T00:00:00.000Z"
    },
    {
      id: "itm-box-l",
      sku: "SKU-CON-PCK-003",
      barcode: "899100200303",
      name: "Corrugated Box Ekspor Ukuran L (60x40x40cm)",
      description: "Kardus packing double wall tahan tekanan beban tumpukan",
      categoryId: "cat-pck",
      categoryName: "Packaging & Consumables",
      unitId: "u-pcs",
      unitSymbol: "PCS",
      supplierId: "sup-03",
      supplierName: "CV Prima Multi Packaging",
      itemType: "CONSUMABLE",
      currentStock: 450,
      minStock: 100,
      maxStock: 1e3,
      reorderPoint: 200,
      safetyStock: 50,
      unitCost: 28e3,
      unitPrice: 35e3,
      specifications: { "Dimensi": "60 x 40 x 40 cm", "Ply": "Double Wall (CB Flute)" },
      isActive: true,
      createdAt: "2026-01-11T00:00:00.000Z",
      updatedAt: "2026-10-14T00:00:00.000Z"
    },
    {
      id: "itm-str-film",
      sku: "SKU-CON-PCK-004",
      barcode: "899100200304",
      name: "Stretch Film Pallet Wrapping 50cm x 300m",
      description: "Plastik wrapping pembungkus pallet anti sobek dan rekat",
      categoryId: "cat-pck",
      categoryName: "Packaging & Consumables",
      unitId: "u-roll",
      unitSymbol: "ROLL",
      supplierId: "sup-03",
      supplierName: "CV Prima Multi Packaging",
      itemType: "CONSUMABLE",
      currentStock: 85,
      minStock: 30,
      maxStock: 300,
      reorderPoint: 50,
      safetyStock: 20,
      unitCost: 75e3,
      unitPrice: 92e3,
      specifications: { "Lebar": "50 cm", "Ketebalan": "17 Micron" },
      isActive: true,
      createdAt: "2026-01-12T00:00:00.000Z",
      updatedAt: "2026-10-12T00:00:00.000Z"
    },
    {
      id: "itm-sft-vest",
      sku: "SKU-CON-SFT-005",
      barcode: "899100200305",
      name: "Rompi Safety Jaring Reflektor Hi-Vis Orange",
      description: "Rompi standar keselamatan kerja lapangan dan operasional gudang",
      categoryId: "cat-sft",
      categoryName: "Safety & PPE",
      unitId: "u-pcs",
      unitSymbol: "PCS",
      supplierId: "sup-02",
      supplierName: "PT Samudera Logistik Sarana",
      itemType: "CONSUMABLE",
      currentStock: 5,
      // CRITICAL STOCK! Min stock is 20!
      minStock: 20,
      maxStock: 150,
      reorderPoint: 30,
      safetyStock: 10,
      unitCost: 35e3,
      unitPrice: 48e3,
      specifications: { "Warna": "Hi-Vis Orange", "Standar": "EN ISO 20471" },
      isActive: true,
      createdAt: "2026-01-15T00:00:00.000Z",
      updatedAt: "2026-10-16T00:00:00.000Z"
    },
    {
      id: "itm-sft-hlm",
      sku: "SKU-CON-SFT-006",
      barcode: "899100200306",
      name: "Safety Helmet V-Gard Putih SNI",
      description: "Helm pelindung kepala pekerja lapangan dengan suspensi ratchet",
      categoryId: "cat-sft",
      categoryName: "Safety & PPE",
      unitId: "u-pcs",
      unitSymbol: "PCS",
      supplierId: "sup-02",
      supplierName: "PT Samudera Logistik Sarana",
      itemType: "CONSUMABLE",
      currentStock: 42,
      minStock: 15,
      maxStock: 100,
      reorderPoint: 25,
      safetyStock: 10,
      unitCost: 85e3,
      unitPrice: 11e4,
      specifications: { "Warna": "Putih", "Sertifikasi": "SNI 0108:2015" },
      isActive: true,
      createdAt: "2026-01-15T00:00:00.000Z",
      updatedAt: "2026-10-10T00:00:00.000Z"
    },
    // Serialized Asset parent master items (ItemType: SERIALIZED_ASSET)
    {
      id: "itm-ast-mbp16",
      sku: "SKU-AST-IT-010",
      barcode: "899100200310",
      name: 'Apple MacBook Pro 16" M3 Max 36GB/1TB',
      description: "Laptop enterprise untuk engineering dan data architecture",
      categoryId: "cat-it-hw",
      categoryName: "IT Hardware & Peripherals",
      unitId: "u-pcs",
      unitSymbol: "PCS",
      supplierId: "sup-01",
      supplierName: "PT Mitra Solusi Teknologi",
      itemType: "SERIALIZED_ASSET",
      currentStock: 4,
      minStock: 2,
      maxStock: 10,
      reorderPoint: 3,
      safetyStock: 1,
      unitCost: 485e5,
      unitPrice: 52e6,
      specifications: { "Chip": "Apple M3 Max 14-core", "RAM": "36GB Unified", "SSD": "1TB NVMe" },
      isActive: true,
      createdAt: "2026-01-20T00:00:00.000Z",
      updatedAt: "2026-10-01T00:00:00.000Z"
    },
    {
      id: "itm-ast-dell7440",
      sku: "SKU-AST-IT-011",
      barcode: "899100200311",
      name: "Dell Latitude 7440 Core i7-1365U 16GB/512GB",
      description: "Laptop standar operasional staf manajemen dan supervisor",
      categoryId: "cat-it-hw",
      categoryName: "IT Hardware & Peripherals",
      unitId: "u-pcs",
      unitSymbol: "PCS",
      supplierId: "sup-01",
      supplierName: "PT Mitra Solusi Teknologi",
      itemType: "SERIALIZED_ASSET",
      currentStock: 6,
      minStock: 3,
      maxStock: 20,
      reorderPoint: 5,
      safetyStock: 2,
      unitCost: 245e5,
      unitPrice: 27e6,
      specifications: { "Processor": "Intel Core i7-1365U", "RAM": "16GB DDR5", "Storage": "512GB PCIe Gen4" },
      isActive: true,
      createdAt: "2026-01-20T00:00:00.000Z",
      updatedAt: "2026-10-02T00:00:00.000Z"
    },
    {
      id: "itm-ast-zebra-tc26",
      sku: "SKU-AST-IT-012",
      barcode: "899100200312",
      name: "Zebra TC26 Mobile Touch Computer Scanner 2D",
      description: "Handheld scanner barcode 2D tangguh untuk operator gudang",
      categoryId: "cat-it-hw",
      categoryName: "IT Hardware & Peripherals",
      unitId: "u-pcs",
      unitSymbol: "PCS",
      supplierId: "sup-01",
      supplierName: "PT Mitra Solusi Teknologi",
      itemType: "SERIALIZED_ASSET",
      currentStock: 8,
      minStock: 4,
      maxStock: 25,
      reorderPoint: 6,
      safetyStock: 2,
      unitCost: 112e5,
      unitPrice: 135e5,
      specifications: { "OS": "Android 11 Enterprise", "Scanner": "SE4710 1D/2D Imager", "IP": "IP67" },
      isActive: true,
      createdAt: "2026-02-01T00:00:00.000Z",
      updatedAt: "2026-10-05T00:00:00.000Z"
    },
    {
      id: "itm-ast-cisco9200",
      sku: "SKU-AST-NET-013",
      barcode: "899100200313",
      name: "Cisco Catalyst 9200L 48-Port PoE+ Gigabit Switch",
      description: "Switch jaringan core enterprise dengan uplink 4x10G SFP+",
      categoryId: "cat-net",
      categoryName: "Networking Equipment",
      unitId: "u-pcs",
      unitSymbol: "PCS",
      supplierId: "sup-01",
      supplierName: "PT Mitra Solusi Teknologi",
      itemType: "SERIALIZED_ASSET",
      currentStock: 3,
      minStock: 1,
      maxStock: 8,
      reorderPoint: 2,
      safetyStock: 1,
      unitCost: 56e6,
      unitPrice: 64e6,
      specifications: { "Ports": "48 PoE+ Ports", "PoE Budget": "740W", "Uplink": "4x 10G SFP+" },
      isActive: true,
      createdAt: "2026-02-01T00:00:00.000Z",
      updatedAt: "2026-09-20T00:00:00.000Z"
    },
    {
      id: "itm-ast-forklift",
      sku: "SKU-AST-MHE-014",
      barcode: "899100200314",
      name: "Toyota Electric Reach Truck Forklift 2.5 Ton 6M",
      description: "Armada angkut palet ketinggian 6 meter bertenaga baterai lithium",
      categoryId: "cat-mhe",
      categoryName: "Material Handling Equipment",
      unitId: "u-pcs",
      unitSymbol: "PCS",
      supplierId: "sup-02",
      supplierName: "PT Samudera Logistik Sarana",
      itemType: "SERIALIZED_ASSET",
      currentStock: 2,
      minStock: 1,
      maxStock: 5,
      reorderPoint: 1,
      safetyStock: 1,
      unitCost: 385e6,
      unitPrice: 42e7,
      specifications: { "Kapasitas": "2,500 Kg", "Mast Height": "6.0 Meter", "Power": "48V Li-ion Battery" },
      isActive: true,
      createdAt: "2026-02-10T00:00:00.000Z",
      updatedAt: "2026-08-15T00:00:00.000Z"
    }
  ];
  const stockBalances = [
    // UTP Cable
    { id: "sb-01", itemId: "itm-cbl-cat6", warehouseId: "wh-jkt-main", warehouseCode: "WH-JKT-01", warehouseName: "Central Distribution Center (CDC)", quantity: 30, reservedQty: 0, updatedAt: "2026-10-15T00:00:00.000Z" },
    { id: "sb-02", itemId: "itm-cbl-cat6", warehouseId: "wh-sby-hub", warehouseCode: "WH-SBY-02", warehouseName: "East Java Regional Fulfillment", quantity: 18, reservedQty: 0, updatedAt: "2026-10-15T00:00:00.000Z" },
    // Thermal paper (low stock!)
    { id: "sb-03", itemId: "itm-thm-paper", warehouseId: "wh-jkt-main", warehouseCode: "WH-JKT-01", warehouseName: "Central Distribution Center (CDC)", quantity: 12, reservedQty: 0, updatedAt: "2026-10-16T00:00:00.000Z" },
    // Corrugated Box
    { id: "sb-04", itemId: "itm-box-l", warehouseId: "wh-jkt-main", warehouseCode: "WH-JKT-01", warehouseName: "Central Distribution Center (CDC)", quantity: 350, reservedQty: 0, updatedAt: "2026-10-14T00:00:00.000Z" },
    { id: "sb-05", itemId: "itm-box-l", warehouseId: "wh-sby-hub", warehouseCode: "WH-SBY-02", warehouseName: "East Java Regional Fulfillment", quantity: 100, reservedQty: 0, updatedAt: "2026-10-14T00:00:00.000Z" },
    // Stretch Film
    { id: "sb-06", itemId: "itm-str-film", warehouseId: "wh-jkt-main", warehouseCode: "WH-JKT-01", warehouseName: "Central Distribution Center (CDC)", quantity: 60, reservedQty: 0, updatedAt: "2026-10-12T00:00:00.000Z" },
    { id: "sb-07", itemId: "itm-str-film", warehouseId: "wh-sby-hub", warehouseCode: "WH-SBY-02", warehouseName: "East Java Regional Fulfillment", quantity: 25, reservedQty: 0, updatedAt: "2026-10-12T00:00:00.000Z" },
    // Safety Vest (critical stock!)
    { id: "sb-08", itemId: "itm-sft-vest", warehouseId: "wh-jkt-main", warehouseCode: "WH-JKT-01", warehouseName: "Central Distribution Center (CDC)", quantity: 5, reservedQty: 0, updatedAt: "2026-10-16T00:00:00.000Z" },
    // Helm
    { id: "sb-09", itemId: "itm-sft-hlm", warehouseId: "wh-jkt-main", warehouseCode: "WH-JKT-01", warehouseName: "Central Distribution Center (CDC)", quantity: 30, reservedQty: 0, updatedAt: "2026-10-10T00:00:00.000Z" },
    { id: "sb-10", itemId: "itm-sft-hlm", warehouseId: "wh-sby-hub", warehouseCode: "WH-SBY-02", warehouseName: "East Java Regional Fulfillment", quantity: 12, reservedQty: 0, updatedAt: "2026-10-10T00:00:00.000Z" },
    // MacBook Pro 16
    { id: "sb-11", itemId: "itm-ast-mbp16", warehouseId: "wh-jkt-main", warehouseCode: "WH-JKT-01", warehouseName: "Central Distribution Center (CDC)", quantity: 4, reservedQty: 0, updatedAt: "2026-10-01T00:00:00.000Z" },
    // Dell Latitude
    { id: "sb-12", itemId: "itm-ast-dell7440", warehouseId: "wh-jkt-main", warehouseCode: "WH-JKT-01", warehouseName: "Central Distribution Center (CDC)", quantity: 4, reservedQty: 0, updatedAt: "2026-10-02T00:00:00.000Z" },
    { id: "sb-13", itemId: "itm-ast-dell7440", warehouseId: "wh-sby-hub", warehouseCode: "WH-SBY-02", warehouseName: "East Java Regional Fulfillment", quantity: 2, reservedQty: 0, updatedAt: "2026-10-02T00:00:00.000Z" },
    // Zebra TC26
    { id: "sb-14", itemId: "itm-ast-zebra-tc26", warehouseId: "wh-jkt-main", warehouseCode: "WH-JKT-01", warehouseName: "Central Distribution Center (CDC)", quantity: 5, reservedQty: 0, updatedAt: "2026-10-05T00:00:00.000Z" },
    { id: "sb-15", itemId: "itm-ast-zebra-tc26", warehouseId: "wh-sby-hub", warehouseCode: "WH-SBY-02", warehouseName: "East Java Regional Fulfillment", quantity: 3, reservedQty: 0, updatedAt: "2026-10-05T00:00:00.000Z" },
    // Cisco switch
    { id: "sb-16", itemId: "itm-ast-cisco9200", warehouseId: "wh-jkt-main", warehouseCode: "WH-JKT-01", warehouseName: "Central Distribution Center (CDC)", quantity: 2, reservedQty: 0, updatedAt: "2026-09-20T00:00:00.000Z" },
    { id: "sb-17", itemId: "itm-ast-cisco9200", warehouseId: "wh-sby-hub", warehouseCode: "WH-SBY-02", warehouseName: "East Java Regional Fulfillment", quantity: 1, reservedQty: 0, updatedAt: "2026-09-20T00:00:00.000Z" },
    // Forklift
    { id: "sb-18", itemId: "itm-ast-forklift", warehouseId: "wh-jkt-main", warehouseCode: "WH-JKT-01", warehouseName: "Central Distribution Center (CDC)", quantity: 1, reservedQty: 0, updatedAt: "2026-08-15T00:00:00.000Z" },
    { id: "sb-19", itemId: "itm-ast-forklift", warehouseId: "wh-sby-hub", warehouseCode: "WH-SBY-02", warehouseName: "East Java Regional Fulfillment", quantity: 1, reservedQty: 0, updatedAt: "2026-08-15T00:00:00.000Z" }
  ];
  const assetUnits = [
    {
      id: "ast-u-001",
      assetTag: "AST-2026-0001",
      serialNumber: "SN-APL-C02GF928MD6R",
      itemId: "itm-ast-mbp16",
      itemName: 'Apple MacBook Pro 16" M3 Max 36GB/1TB',
      itemSku: "SKU-AST-IT-010",
      warehouseId: "wh-jkt-main",
      warehouseName: "Central Distribution Center (CDC)",
      locationId: "loc-01",
      locationCode: "A1-R01-S01",
      status: "ASSIGNED",
      condition: "EXCELLENT",
      assignedToUserId: "usr-admin-01",
      assignedToUserName: "Budi Pratama (Super Admin)",
      department: "Executive Operations",
      purchaseDate: "2026-02-15",
      purchaseCost: 485e5,
      warrantyExpiry: "2029-02-15",
      notes: "Diserahkan dalam kondisi baru dengan AppleCare+ 3 Tahun.",
      createdAt: "2026-02-15T00:00:00.000Z",
      updatedAt: "2026-02-15T00:00:00.000Z"
    },
    {
      id: "ast-u-002",
      assetTag: "AST-2026-0002",
      serialNumber: "SN-APL-C02HH391MD6S",
      itemId: "itm-ast-mbp16",
      itemName: 'Apple MacBook Pro 16" M3 Max 36GB/1TB',
      itemSku: "SKU-AST-IT-010",
      warehouseId: "wh-jkt-main",
      warehouseName: "Central Distribution Center (CDC)",
      locationId: "loc-01",
      locationCode: "A1-R01-S01",
      status: "AVAILABLE",
      condition: "NEW",
      purchaseDate: "2026-02-15",
      purchaseCost: 485e5,
      warrantyExpiry: "2029-02-15",
      notes: "Stok cadangan IT di brankas server room CDC.",
      createdAt: "2026-02-15T00:00:00.000Z",
      updatedAt: "2026-02-15T00:00:00.000Z"
    },
    {
      id: "ast-u-003",
      assetTag: "AST-2026-0003",
      serialNumber: "SN-DLL-8F74B291",
      itemId: "itm-ast-dell7440",
      itemName: "Dell Latitude 7440 Core i7-1365U 16GB/512GB",
      itemSku: "SKU-AST-IT-011",
      warehouseId: "wh-jkt-main",
      warehouseName: "Central Distribution Center (CDC)",
      status: "ASSIGNED",
      condition: "GOOD",
      assignedToUserId: "usr-mgr-01",
      assignedToUserName: "Dewi Kartika (Warehouse Mgr)",
      department: "Supply Chain & Logistics",
      purchaseDate: "2026-03-01",
      purchaseCost: 245e5,
      warrantyExpiry: "2029-03-01",
      notes: "Laptop operasional Warehouse Manager CDC Jakarta.",
      createdAt: "2026-03-01T00:00:00.000Z",
      updatedAt: "2026-03-01T00:00:00.000Z"
    },
    {
      id: "ast-u-004",
      assetTag: "AST-2026-0004",
      serialNumber: "SN-ZBR-2231052044",
      itemId: "itm-ast-zebra-tc26",
      itemName: "Zebra TC26 Mobile Touch Computer Scanner 2D",
      itemSku: "SKU-AST-IT-012",
      warehouseId: "wh-jkt-main",
      warehouseName: "Central Distribution Center (CDC)",
      status: "ASSIGNED",
      condition: "GOOD",
      assignedToUserId: "usr-staff-01",
      assignedToUserName: "Rian Hidayat (Inventory Staff)",
      department: "Central Fulfillment",
      purchaseDate: "2026-03-10",
      purchaseCost: 112e5,
      warrantyExpiry: "2028-03-10",
      notes: "Scanner utama untuk Goods Inbound & Picking di CDC.",
      createdAt: "2026-03-10T00:00:00.000Z",
      updatedAt: "2026-03-10T00:00:00.000Z"
    },
    {
      id: "ast-u-005",
      assetTag: "AST-2026-0005",
      serialNumber: "SN-ZBR-2231052045",
      itemId: "itm-ast-zebra-tc26",
      itemName: "Zebra TC26 Mobile Touch Computer Scanner 2D",
      itemSku: "SKU-AST-IT-012",
      warehouseId: "wh-jkt-main",
      warehouseName: "Central Distribution Center (CDC)",
      status: "IN_MAINTENANCE",
      condition: "FAIR",
      department: "Central Fulfillment",
      purchaseDate: "2026-03-10",
      purchaseCost: 112e5,
      warrantyExpiry: "2028-03-10",
      notes: "Sedang kalibrasi trigger scan laser di vendor resmi Zebra.",
      createdAt: "2026-03-10T00:00:00.000Z",
      updatedAt: "2026-10-10T00:00:00.000Z"
    },
    {
      id: "ast-u-006",
      assetTag: "AST-2026-0006",
      serialNumber: "SN-TYT-FL882901J",
      itemId: "itm-ast-forklift",
      itemName: "Toyota Electric Reach Truck Forklift 2.5 Ton 6M",
      itemSku: "SKU-AST-MHE-014",
      warehouseId: "wh-jkt-main",
      warehouseName: "Central Distribution Center (CDC)",
      status: "AVAILABLE",
      condition: "EXCELLENT",
      department: "Operations",
      purchaseDate: "2026-01-05",
      purchaseCost: 385e6,
      warrantyExpiry: "2031-01-05",
      notes: "Layanan servis rutin berkala setiap 500 jam operasi.",
      createdAt: "2026-01-05T00:00:00.000Z",
      updatedAt: "2026-09-01T00:00:00.000Z"
    }
  ];
  const stockMovements = [
    {
      id: "mov-001",
      movementNumber: "MOV-202610-001",
      type: "IN",
      status: "COMPLETED",
      targetWarehouseId: "wh-jkt-main",
      targetWarehouseName: "Central Distribution Center (CDC)",
      supplierId: "sup-01",
      supplierName: "PT Mitra Solusi Teknologi",
      referenceDoc: "PO-2026-10-089",
      idempotencyKey: "IDEMP-PO-202610-089",
      notes: "Penerimaan stok rutin kabel UTP dan barcode scanner inbound.",
      createdByUserId: "usr-staff-01",
      createdByName: "Rian Hidayat",
      approvedByUserId: "usr-mgr-01",
      approvedByName: "Dewi Kartika",
      createdAt: "2026-10-10T09:30:00.000Z",
      details: [
        {
          id: "smd-01",
          movementId: "mov-001",
          itemId: "itm-cbl-cat6",
          itemSku: "SKU-CON-NET-001",
          itemName: "Kabel UTP Belden Cat6 305M Roll",
          quantity: 20,
          unitCost: 185e4,
          subtotal: 37e6
        }
      ]
    },
    {
      id: "mov-002",
      movementNumber: "MOV-202610-002",
      type: "TRANSFER",
      status: "COMPLETED",
      sourceWarehouseId: "wh-jkt-main",
      sourceWarehouseName: "Central Distribution Center (CDC)",
      targetWarehouseId: "wh-sby-hub",
      targetWarehouseName: "East Java Regional Fulfillment",
      referenceDoc: "TRF-JKT-SBY-044",
      idempotencyKey: "IDEMP-TRF-044",
      notes: "Relokasi stok kemasan corrugated box ke cabang Surabaya untuk persiapan promo akhir tahun.",
      createdByUserId: "usr-mgr-01",
      createdByName: "Dewi Kartika",
      approvedByUserId: "usr-admin-01",
      approvedByName: "Budi Pratama",
      createdAt: "2026-10-12T14:15:00.000Z",
      details: [
        {
          id: "smd-02",
          movementId: "mov-002",
          itemId: "itm-box-l",
          itemSku: "SKU-CON-PCK-003",
          itemName: "Corrugated Box Ekspor Ukuran L (60x40x40cm)",
          quantity: 50,
          unitCost: 28e3,
          subtotal: 14e5
        }
      ]
    },
    {
      id: "mov-003",
      movementNumber: "MOV-202610-003",
      type: "OUT",
      status: "COMPLETED",
      sourceWarehouseId: "wh-jkt-main",
      sourceWarehouseName: "Central Distribution Center (CDC)",
      referenceDoc: "REQ-OPS-2026-112",
      idempotencyKey: "IDEMP-REQ-112",
      notes: "Pengeluaran alat pelindung diri untuk tim teknisi lapangan CDC.",
      createdByUserId: "usr-staff-01",
      createdByName: "Rian Hidayat",
      approvedByUserId: "usr-mgr-01",
      approvedByName: "Dewi Kartika",
      createdAt: "2026-10-14T11:20:00.000Z",
      details: [
        {
          id: "smd-03",
          movementId: "mov-003",
          itemId: "itm-sft-vest",
          itemSku: "SKU-CON-SFT-005",
          itemName: "Rompi Safety Jaring Reflektor Hi-Vis Orange",
          quantity: 15,
          unitCost: 35e3,
          subtotal: 525e3
        }
      ]
    }
  ];
  const auditLogs = [
    {
      id: "aud-001",
      action: "SYSTEM_INITIALIZATION",
      entity: "System",
      entityId: "SYS-INIT",
      userId: "usr-admin-01",
      userName: "Budi Pratama (Super Admin)",
      ipAddress: "127.0.0.1",
      detailsJson: { message: "Database initialized and schema verified successfully." },
      createdAt: "2026-10-10T08:00:00.000Z"
    },
    {
      id: "aud-002",
      action: "GOODS_RECEIPT",
      entity: "StockMovement",
      entityId: "mov-001",
      userId: "usr-staff-01",
      userName: "Rian Hidayat",
      ipAddress: "192.168.1.45",
      detailsJson: { movementNumber: "MOV-202610-001", type: "IN", targetWh: "wh-jkt-main", itemsCount: 1 },
      createdAt: "2026-10-10T09:30:00.000Z"
    },
    {
      id: "aud-003",
      action: "STOCK_TRANSFER",
      entity: "StockMovement",
      entityId: "mov-002",
      userId: "usr-mgr-01",
      userName: "Dewi Kartika",
      ipAddress: "192.168.1.12",
      detailsJson: { movementNumber: "MOV-202610-002", sourceWh: "wh-jkt-main", targetWh: "wh-sby-hub", qty: 50 },
      createdAt: "2026-10-12T14:15:00.000Z"
    },
    {
      id: "aud-004",
      action: "GOODS_ISSUE",
      entity: "StockMovement",
      entityId: "mov-003",
      userId: "usr-staff-01",
      userName: "Rian Hidayat",
      ipAddress: "192.168.1.45",
      detailsJson: { movementNumber: "MOV-202610-003", type: "OUT", qty: 15 },
      createdAt: "2026-10-14T11:20:00.000Z"
    }
  ];
  return {
    users,
    categories,
    units,
    suppliers,
    warehouses,
    locations,
    items,
    stockBalances,
    assetUnits,
    stockMovements,
    auditLogs
  };
}

// server/db/store.ts
var DATA_DIR = path.resolve(process.cwd(), ".data");
var DB_FILE = path.join(DATA_DIR, "inventra-db.json");
var isLocked = false;
async function acquireLock(timeoutMs = 5e3) {
  const start = Date.now();
  while (isLocked) {
    if (Date.now() - start > timeoutMs) {
      throw new Error("Database transaction lock timeout");
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  isLocked = true;
}
function releaseLock() {
  isLocked = false;
}
var DatabaseStore = class {
  constructor() {
    this.ensureDataDir();
    this.data = this.loadData();
  }
  ensureDataDir() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  }
  loadData() {
    if (fs.existsSync(DB_FILE)) {
      try {
        const raw = fs.readFileSync(DB_FILE, "utf-8");
        return JSON.parse(raw);
      } catch (err) {
        console.warn("Failed to read db file, re-seeding...", err);
      }
    }
    const seed = getInitialSeedData();
    const initial = {
      ...seed,
      assetAssignments: [],
      stockOpnames: [],
      itemRequests: []
    };
    this.saveDataDirect(initial);
    return initial;
  }
  saveDataDirect(data) {
    try {
      this.ensureDataDir();
      fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), "utf-8");
    } catch (err) {
      console.error("Error persisting database to disk:", err);
    }
  }
  async persist() {
    this.saveDataDirect(this.data);
  }
  resetToSeed() {
    const seed = getInitialSeedData();
    this.data = {
      ...seed,
      assetAssignments: [],
      stockOpnames: [],
      itemRequests: []
    };
    this.saveDataDirect(this.data);
    return this.data;
  }
  // --- Transaction Runner ---
  async runTransaction(fn) {
    await acquireLock();
    try {
      const result = await fn(this);
      await this.persist();
      return result;
    } finally {
      releaseLock();
    }
  }
  // --- Audit Trail Logging ---
  logAudit(entry) {
    const newLog = {
      id: `aud-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId,
      userId: entry.userId,
      userName: entry.userName,
      ipAddress: entry.ipAddress || "127.0.0.1",
      detailsJson: entry.detailsJson,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.data.auditLogs.unshift(newLog);
    return newLog;
  }
  // --- Users ---
  getUsers() {
    return this.data.users.map(({ passwordHash, ...rest }) => rest);
  }
  findUserByEmail(email) {
    return this.data.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  }
  findUserById(id) {
    return this.data.users.find((u) => u.id === id);
  }
  // --- Categories & Units ---
  getCategories() {
    return this.data.categories;
  }
  getUnits() {
    return this.data.units;
  }
  getSuppliers() {
    return this.data.suppliers;
  }
  // --- Warehouses ---
  getWarehouses() {
    return this.data.warehouses;
  }
  getWarehouseById(id) {
    return this.data.warehouses.find((w) => w.id === id);
  }
  createWarehouse(input) {
    const id = `wh-${input.code.toLowerCase().replace(/[^a-z0-9]/g, "-")}`;
    const newWarehouse = {
      ...input,
      id,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.data.warehouses.push(newWarehouse);
    return newWarehouse;
  }
  // --- Items ---
  getItems(filters) {
    let list = this.data.items.map((item) => {
      const balances = this.data.stockBalances.filter((sb) => sb.itemId === item.id);
      return {
        ...item,
        stockBalances: balances
      };
    });
    if (filters?.search) {
      const q = filters.search.toLowerCase();
      list = list.filter(
        (i) => i.name.toLowerCase().includes(q) || i.sku.toLowerCase().includes(q) || i.barcode && i.barcode.includes(q)
      );
    }
    if (filters?.categoryId) {
      list = list.filter((i) => i.categoryId === filters.categoryId);
    }
    if (filters?.itemType) {
      list = list.filter((i) => i.itemType === filters.itemType);
    }
    if (filters?.stockStatus) {
      if (filters.stockStatus === "low") {
        list = list.filter((i) => i.currentStock <= i.minStock && i.currentStock > 0);
      } else if (filters.stockStatus === "out") {
        list = list.filter((i) => i.currentStock <= 0);
      } else if (filters.stockStatus === "normal") {
        list = list.filter((i) => i.currentStock > i.minStock);
      }
    }
    const total = list.length;
    const page = filters?.page || 1;
    const limit = filters?.limit || 50;
    const offset = (page - 1) * limit;
    const paginated = list.slice(offset, offset + limit);
    return {
      items: paginated,
      total,
      page,
      limit
    };
  }
  getItemById(id) {
    const item = this.data.items.find((i) => i.id === id || i.sku === id);
    if (!item) return void 0;
    const balances = this.data.stockBalances.filter((sb) => sb.itemId === item.id);
    return {
      ...item,
      stockBalances: balances
    };
  }
  createItem(input) {
    if (this.data.items.some((i) => i.sku.toLowerCase() === input.sku.toLowerCase())) {
      throw new Error(`SKU '${input.sku}' sudah terdaftar dalam sistem.`);
    }
    const id = `itm-${Date.now()}`;
    const category = this.data.categories.find((c) => c.id === input.categoryId);
    const unit = this.data.units.find((u) => u.id === input.unitId);
    const supplier = input.supplierId ? this.data.suppliers.find((s) => s.id === input.supplierId) : void 0;
    const newItem = {
      ...input,
      id,
      categoryName: category?.name,
      unitSymbol: unit?.symbol,
      supplierName: supplier?.name,
      currentStock: input.currentStock || 0,
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.data.items.push(newItem);
    if (newItem.currentStock > 0) {
      const defaultWh = this.data.warehouses[0];
      if (defaultWh) {
        this.data.stockBalances.push({
          id: `sb-${Date.now()}`,
          itemId: newItem.id,
          warehouseId: defaultWh.id,
          warehouseCode: defaultWh.code,
          warehouseName: defaultWh.name,
          quantity: newItem.currentStock,
          reservedQty: 0,
          updatedAt: (/* @__PURE__ */ new Date()).toISOString()
        });
      }
    }
    return newItem;
  }
  updateItem(id, updates) {
    const idx = this.data.items.findIndex((i) => i.id === id);
    if (idx === -1) {
      throw new Error(`Barang dengan ID '${id}' tidak ditemukan.`);
    }
    const current = this.data.items[idx];
    const updated = {
      ...current,
      ...updates,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    if (updates.categoryId && updates.categoryId !== current.categoryId) {
      const cat = this.data.categories.find((c) => c.id === updates.categoryId);
      updated.categoryName = cat?.name;
    }
    if (updates.unitId && updates.unitId !== current.unitId) {
      const unit = this.data.units.find((u) => u.id === updates.unitId);
      updated.unitSymbol = unit?.symbol;
    }
    this.data.items[idx] = updated;
    return updated;
  }
  // --- Stock Balances ---
  getStockBalance(itemId, warehouseId) {
    return this.data.stockBalances.find((sb) => sb.itemId === itemId && sb.warehouseId === warehouseId);
  }
  setStockBalance(itemId, warehouseId, quantity) {
    if (quantity < 0) {
      throw new Error("Stock balance quantity cannot be negative.");
    }
    let balance = this.data.stockBalances.find((sb) => sb.itemId === itemId && sb.warehouseId === warehouseId);
    const wh = this.data.warehouses.find((w) => w.id === warehouseId);
    if (balance) {
      balance.quantity = quantity;
      balance.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    } else {
      balance = {
        id: `sb-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        itemId,
        warehouseId,
        warehouseCode: wh?.code,
        warehouseName: wh?.name,
        quantity,
        reservedQty: 0,
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      this.data.stockBalances.push(balance);
    }
    return balance;
  }
  // --- Atomic Stock Movements Execution ---
  async executeStockMovement(input) {
    return this.runTransaction(async (db) => {
      if (input.idempotencyKey) {
        const existing = db.data.stockMovements.find((m) => m.idempotencyKey === input.idempotencyKey);
        if (existing) {
          return existing;
        }
      }
      if (!input.details || input.details.length === 0) {
        throw new Error("Transaksi harus menyertakan minimal 1 item.");
      }
      const creator = db.findUserById(input.createdByUserId);
      const sourceWh = input.sourceWarehouseId ? db.getWarehouseById(input.sourceWarehouseId) : void 0;
      const targetWh = input.targetWarehouseId ? db.getWarehouseById(input.targetWarehouseId) : void 0;
      const supplier = input.supplierId ? db.data.suppliers.find((s) => s.id === input.supplierId) : void 0;
      const movementId = `mov-${Date.now()}`;
      const movementNumber = `MOV-${(/* @__PURE__ */ new Date()).toISOString().slice(0, 7).replace("-", "")}-${Math.floor(100 + Math.random() * 900)}`;
      const movementDetails = [];
      for (const row of input.details) {
        if (row.quantity <= 0) {
          throw new Error(`Kuantitas item harus lebih besar dari 0.`);
        }
        const item = db.data.items.find((i) => i.id === row.itemId);
        if (!item) {
          throw new Error(`Barang dengan ID '${row.itemId}' tidak ditemukan.`);
        }
        const unitCost = row.unitCost !== void 0 ? row.unitCost : item.unitCost;
        const subtotal = unitCost * row.quantity;
        if (input.type === "IN") {
          if (!input.targetWarehouseId) {
            throw new Error("Gudang tujuan (targetWarehouseId) wajib ditentukan untuk barang masuk.");
          }
          const currentBal = db.getStockBalance(item.id, input.targetWarehouseId);
          const currentQty = currentBal ? currentBal.quantity : 0;
          db.setStockBalance(item.id, input.targetWarehouseId, currentQty + row.quantity);
          item.currentStock += row.quantity;
          item.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
        } else if (input.type === "OUT") {
          if (!input.sourceWarehouseId) {
            throw new Error("Gudang asal (sourceWarehouseId) wajib ditentukan untuk barang keluar.");
          }
          const currentBal = db.getStockBalance(item.id, input.sourceWarehouseId);
          const availableQty = currentBal ? currentBal.quantity : 0;
          if (availableQty < row.quantity) {
            throw new Error(
              `Stok tidak mencukupi untuk '${item.name}' di ${sourceWh?.name || "Gudang"}. Tersedia: ${availableQty} ${item.unitSymbol || "unit"}, diminta: ${row.quantity}.`
            );
          }
          db.setStockBalance(item.id, input.sourceWarehouseId, availableQty - row.quantity);
          item.currentStock = Math.max(0, item.currentStock - row.quantity);
          item.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
        } else if (input.type === "TRANSFER") {
          if (!input.sourceWarehouseId || !input.targetWarehouseId) {
            throw new Error("Gudang asal dan gudang tujuan harus ditentukan untuk mutasi transfer.");
          }
          if (input.sourceWarehouseId === input.targetWarehouseId) {
            throw new Error("Gudang asal dan gudang tujuan tidak boleh sama.");
          }
          const sourceBal = db.getStockBalance(item.id, input.sourceWarehouseId);
          const sourceQty = sourceBal ? sourceBal.quantity : 0;
          if (sourceQty < row.quantity) {
            throw new Error(
              `Stok gudang asal tidak mencukupi untuk transfer '${item.name}'. Tersedia: ${sourceQty}, diminta: ${row.quantity}.`
            );
          }
          const targetBal = db.getStockBalance(item.id, input.targetWarehouseId);
          const targetQty = targetBal ? targetBal.quantity : 0;
          db.setStockBalance(item.id, input.sourceWarehouseId, sourceQty - row.quantity);
          db.setStockBalance(item.id, input.targetWarehouseId, targetQty + row.quantity);
          item.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
        } else if (input.type === "ADJUSTMENT") {
          if (!input.targetWarehouseId && !input.sourceWarehouseId) {
            throw new Error("Gudang harus ditentukan untuk penyesuaian stok.");
          }
          const whId = input.targetWarehouseId || input.sourceWarehouseId;
          const currentBal = db.getStockBalance(item.id, whId);
          const currentQty = currentBal ? currentBal.quantity : 0;
          db.setStockBalance(item.id, whId, Math.max(0, currentQty + row.quantity));
          item.currentStock = Math.max(0, item.currentStock + row.quantity);
          item.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
        }
        movementDetails.push({
          id: `smd-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          movementId,
          itemId: item.id,
          itemSku: item.sku,
          itemName: item.name,
          quantity: row.quantity,
          unitCost,
          subtotal,
          notes: row.notes
        });
      }
      const newMovement = {
        id: movementId,
        movementNumber,
        type: input.type,
        status: "COMPLETED",
        sourceWarehouseId: input.sourceWarehouseId,
        sourceWarehouseName: sourceWh?.name,
        targetWarehouseId: input.targetWarehouseId,
        targetWarehouseName: targetWh?.name,
        supplierId: input.supplierId,
        supplierName: supplier?.name,
        referenceDoc: input.referenceDoc,
        idempotencyKey: input.idempotencyKey,
        notes: input.notes,
        createdByUserId: input.createdByUserId,
        createdByName: creator?.name || "User",
        createdAt: (/* @__PURE__ */ new Date()).toISOString(),
        details: movementDetails
      };
      db.data.stockMovements.unshift(newMovement);
      db.logAudit({
        action: `STOCK_${input.type}`,
        entity: "StockMovement",
        entityId: newMovement.id,
        userId: creator?.id,
        userName: creator?.name,
        detailsJson: {
          movementNumber: newMovement.movementNumber,
          type: input.type,
          itemsCount: movementDetails.length,
          referenceDoc: input.referenceDoc
        }
      });
      return newMovement;
    });
  }
  getStockMovements(filters) {
    let list = this.data.stockMovements;
    if (filters?.type) {
      list = list.filter((m) => m.type === filters.type);
    }
    if (filters?.warehouseId) {
      list = list.filter((m) => m.sourceWarehouseId === filters.warehouseId || m.targetWarehouseId === filters.warehouseId);
    }
    const total = list.length;
    const page = filters?.page || 1;
    const limit = filters?.limit || 50;
    const offset = (page - 1) * limit;
    return {
      movements: list.slice(offset, offset + limit),
      total
    };
  }
  // --- Serialized Asset Units ---
  getAssetUnits(filters) {
    let list = this.data.assetUnits;
    if (filters?.status) {
      list = list.filter((a) => a.status === filters.status);
    }
    if (filters?.condition) {
      list = list.filter((a) => a.condition === filters.condition);
    }
    if (filters?.warehouseId) {
      list = list.filter((a) => a.warehouseId === filters.warehouseId);
    }
    if (filters?.assignedToUserId) {
      list = list.filter((a) => a.assignedToUserId === filters.assignedToUserId);
    }
    if (filters?.search) {
      const q = filters.search.toLowerCase();
      list = list.filter(
        (a) => a.assetTag.toLowerCase().includes(q) || a.serialNumber.toLowerCase().includes(q) || a.itemName && a.itemName.toLowerCase().includes(q)
      );
    }
    return list;
  }
  getAssetById(id) {
    return this.data.assetUnits.find((a) => a.id === id || a.assetTag === id || a.serialNumber === id);
  }
  createAssetUnit(input) {
    if (this.data.assetUnits.some((a) => a.assetTag.toLowerCase() === input.assetTag.toLowerCase())) {
      throw new Error(`Asset Tag '${input.assetTag}' sudah digunakan.`);
    }
    if (this.data.assetUnits.some((a) => a.serialNumber.toLowerCase() === input.serialNumber.toLowerCase())) {
      throw new Error(`Serial Number '${input.serialNumber}' sudah terdaftar.`);
    }
    const item = this.data.items.find((i) => i.id === input.itemId);
    if (!item) {
      throw new Error(`Item ID '${input.itemId}' tidak ditemukan.`);
    }
    if (item.itemType !== "SERIALIZED_ASSET") {
      throw new Error(`Item '${item.name}' bertipe CONSUMABLE dan tidak dapat didaftarkan sebagai serialized asset unit.`);
    }
    const wh = this.data.warehouses.find((w) => w.id === input.warehouseId);
    const newAsset = {
      ...input,
      id: `ast-${Date.now()}`,
      itemName: item.name,
      itemSku: item.sku,
      warehouseName: wh?.name,
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.data.assetUnits.unshift(newAsset);
    item.currentStock += 1;
    item.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    return newAsset;
  }
  updateAssetStatus(assetId, updates) {
    const asset = this.data.assetUnits.find((a) => a.id === assetId);
    if (!asset) {
      throw new Error(`Unit aset '${assetId}' tidak ditemukan.`);
    }
    if (updates.assignedToUserId) {
      const user = this.findUserById(updates.assignedToUserId);
      asset.assignedToUserId = user?.id;
      asset.assignedToUserName = user?.name;
      asset.department = updates.department || user?.department;
      asset.status = "ASSIGNED";
    } else if (updates.status === "AVAILABLE") {
      asset.assignedToUserId = void 0;
      asset.assignedToUserName = void 0;
      asset.status = "AVAILABLE";
    }
    if (updates.status) asset.status = updates.status;
    if (updates.condition) asset.condition = updates.condition;
    if (updates.notes) asset.notes = updates.notes;
    asset.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    return asset;
  }
  // --- Audit Logs ---
  getAuditLogs(limit = 100) {
    return this.data.auditLogs.slice(0, limit);
  }
  // --- Item Requests ---
  getItemRequests() {
    return this.data.itemRequests;
  }
  createItemRequest(input) {
    const id = `req-${Date.now()}`;
    const requestNumber = `REQ-${(/* @__PURE__ */ new Date()).toISOString().slice(0, 7).replace("-", "")}-${Math.floor(100 + Math.random() * 900)}`;
    const user = this.findUserById(input.requestedByUserId);
    const newReq = {
      ...input,
      id,
      requestNumber,
      requestedByName: user?.name,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.data.itemRequests.unshift(newReq);
    return newReq;
  }
  // --- Stock Opnames ---
  getStockOpnames() {
    return this.data.stockOpnames;
  }
  createStockOpname(input) {
    const id = `opn-${Date.now()}`;
    const opnameNumber = `OPN-${(/* @__PURE__ */ new Date()).toISOString().slice(0, 7).replace("-", "")}-${Math.floor(100 + Math.random() * 900)}`;
    const wh = this.getWarehouseById(input.warehouseId);
    const newOpn = {
      ...input,
      id,
      opnameNumber,
      warehouseName: wh?.name,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.data.stockOpnames.unshift(newOpn);
    return newOpn;
  }
};
var dbStore = new DatabaseStore();

// server/db/repository.ts
var RepositoryManager = class {
  constructor() {
    this.activeRepo = null;
    this.activeEngine = "STANDALONE_STORE";
    this.initialized = false;
  }
  async getRepository() {
    if (!this.initialized) {
      await this.init();
    }
    return this.activeRepo;
  }
  getActiveEngine() {
    return this.activeEngine;
  }
  async init() {
    const isProduction2 = process.env.NODE_ENV === "production";
    const hasDbUrl = Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL.trim());
    if (hasDbUrl) {
      const prisma = getPrismaClient();
      if (prisma) {
        try {
          const health = await testDatabaseConnectivity();
          if (health.status === "CONNECTED") {
            console.log(`[DB] Berhasil terhubung ke MySQL Hostinger (${health.host}) versi ${health.databaseVersion}`);
            this.activeRepo = new PrismaMySQLRepository(prisma);
            this.activeEngine = "PRISMA_MYSQL";
            this.initialized = true;
            return;
          } else {
            console.warn(`[DB WARNING] DATABASE_URL terpasang namun tes koneksi gagal: ${health.error}`);
            if (isProduction2) {
              throw new Error(`Production database failure: Cannot connect to MySQL (${health.error}). Running without database in production is strictly forbidden.`);
            }
          }
        } catch (err) {
          console.error("[DB ERROR] Error connecting to Prisma MySQL:", err.message);
          if (isProduction2) {
            throw err;
          }
        }
      }
    } else {
      if (isProduction2) {
        throw new Error("Production environment failure: DATABASE_URL is required in production.");
      }
    }
    console.log("[DB] Menggunakan Standalone Persistent Store (Development / Isolated Sandbox Mode)");
    this.activeRepo = dbStore;
    this.activeEngine = "STANDALONE_STORE";
    this.initialized = true;
  }
};
var repoManager = new RepositoryManager();

// server.ts
var __filename = fileURLToPath(import.meta.url);
var __dirname = path2.dirname(__filename);
async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3e3;
  const isProduction2 = process.env.NODE_ENV === "production";
  await repoManager.init();
  app.use(express.json({ limit: "5mb" }));
  app.use((req, res, next) => {
    if (req.path.startsWith("/api") && req.method !== "GET") {
      const sanitizedBody = { ...req.body };
      if (sanitizedBody.password) sanitizedBody.password = "[REDACTED]";
      if (sanitizedBody.token) sanitizedBody.token = "[REDACTED]";
      console.log(`[API ${req.method}] ${req.path}`);
    }
    next();
  });
  app.get("/api/health", async (req, res) => {
    try {
      const dbHealth = await testDatabaseConnectivity();
      const isOk = dbHealth.status === "CONNECTED" || !isProduction2 && dbHealth.status === "NOT_CONFIGURED";
      res.status(isOk ? 200 : 503).json({
        status: isOk ? "UP" : "DEGRADED",
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        environment: isProduction2 ? "production" : "development",
        activeEngine: repoManager.getActiveEngine(),
        database: dbHealth,
        uptime: process.uptime()
      });
    } catch (err) {
      res.status(500).json({
        status: "DOWN",
        error: err.message,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
    }
  });
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        res.status(400).json({ error: "Email dan password wajib diisi." });
        return;
      }
      const repo = await repoManager.getRepository();
      const user = await repo.findUserByEmail(email);
      if (!user || !verifyPassword(password, user.passwordHash)) {
        res.status(401).json({ error: "Email atau password salah." });
        return;
      }
      if (!user.isActive) {
        res.status(403).json({ error: "Akun Anda sedang dinonaktifkan. Silakan hubungi administrator." });
        return;
      }
      const token = signToken({
        userId: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        department: user.department
      });
      const { passwordHash, ...safeUser } = user;
      await repo.logAudit({
        action: "USER_LOGIN",
        entity: "User",
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
    } catch (err) {
      console.error("[AUTH ERROR] Login failed:", err);
      res.status(500).json({ error: "Terjadi kesalahan sistem saat proses masuk." });
    }
  });
  app.get("/api/auth/me", authenticateToken, async (req, res) => {
    try {
      const repo = await repoManager.getRepository();
      const user = await repo.findUserById(req.user.userId);
      if (!user) {
        res.json({
          user: {
            id: req.user.userId,
            email: req.user.email,
            name: req.user.name,
            role: req.user.role,
            department: req.user.department,
            permissions: ROLE_PERMISSIONS[req.user.role] || []
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
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app.post("/api/auth/switch-role", async (req, res) => {
    if (isProduction2) {
      res.status(403).json({
        error: "Peralihan peran instan dinonaktifkan pada lingkungan produksi. Silakan login dengan akun yang sesuai.",
        code: "SWITCH_ROLE_DISABLED_IN_PROD"
      });
      return;
    }
    const { role } = req.body;
    if (!role || !ROLE_PERMISSIONS[role]) {
      res.status(400).json({ error: "Peran tidak valid." });
      return;
    }
    try {
      const repo = await repoManager.getRepository();
      const users = await repo.getUsers();
      const matchedUser = users.find((u) => u.role === role) || users[0];
      const token = signToken({
        userId: matchedUser.id,
        email: matchedUser.email,
        name: matchedUser.name,
        role: matchedUser.role,
        department: matchedUser.department
      });
      res.json({
        token,
        user: {
          ...matchedUser,
          permissions: ROLE_PERMISSIONS[matchedUser.role] || []
        }
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app.get("/api/dashboard", authenticateToken, async (req, res) => {
    try {
      const repo = await repoManager.getRepository();
      const { items } = await repo.getItems({ limit: 1e3 });
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
      const warehouseBreakdown = warehouses.map((wh) => {
        let whItemCount = 0;
        let whTotalQty = 0;
        for (const item of items) {
          const bal = item.stockBalances?.find((b) => b.warehouseId === wh.id);
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
        { month: "Mei", in: 420, out: 380, transfer: 95 },
        { month: "Jun", in: 510, out: 490, transfer: 110 },
        { month: "Jul", in: 460, out: 430, transfer: 80 },
        { month: "Agu", in: 580, out: 540, transfer: 140 },
        { month: "Sep", in: 620, out: 590, transfer: 130 },
        { month: "Okt", in: 710, out: 645, transfer: 165 }
      ];
      res.json({
        summary: {
          totalItems: items.length,
          totalStockValuation,
          lowStockCount,
          outOfStockCount,
          totalWarehouses: warehouses.length,
          activeAssetUnits: assets.filter((a) => a.status === "AVAILABLE" || a.status === "ASSIGNED").length,
          inMaintenanceAssets: assets.filter((a) => a.status === "IN_MAINTENANCE").length
        },
        warehouseBreakdown,
        recentMovements: movements.slice(0, 5),
        movementTrends,
        lowStockItems: items.filter((i) => i.currentStock <= i.minStock).slice(0, 5)
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app.get("/api/items", authenticateToken, async (req, res) => {
    try {
      const repo = await repoManager.getRepository();
      const { search, categoryId, itemType, stockStatus, page, limit } = req.query;
      const result = await repo.getItems({
        search,
        categoryId,
        itemType,
        stockStatus,
        page: page ? parseInt(page, 10) : 1,
        limit: limit ? parseInt(limit, 10) : 50
      });
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app.get("/api/items/:id", authenticateToken, async (req, res) => {
    try {
      const repo = await repoManager.getRepository();
      const item = await repo.getItemById(req.params.id);
      if (!item) {
        res.status(404).json({ error: "Barang tidak ditemukan." });
        return;
      }
      const allAssets = await repo.getAssetUnits();
      const assetUnits = item.itemType === "SERIALIZED_ASSET" ? allAssets.filter((a) => a.itemId === item.id) : [];
      res.json({ item, assetUnits });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app.post("/api/items", authenticateToken, requirePermission("items:create"), async (req, res) => {
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
        res.status(400).json({ error: "SKU, Nama Barang, Kategori, dan Satuan wajib diisi." });
        return;
      }
      const repo = await repoManager.getRepository();
      const newItem = await repo.createItem({
        sku,
        barcode: barcode || void 0,
        name,
        description: description || "",
        categoryId,
        unitId,
        supplierId: supplierId || void 0,
        itemType: itemType || "CONSUMABLE",
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
        action: "CREATE_ITEM",
        entity: "Item",
        entityId: newItem.id,
        userId: req.user?.userId,
        userName: req.user?.name,
        detailsJson: { sku: newItem.sku, name: newItem.name, type: newItem.itemType }
      });
      res.status(201).json({ item: newItem });
    } catch (err) {
      res.status(400).json({ error: err.message || "Gagal membuat barang baru." });
    }
  });
  app.put("/api/items/:id", authenticateToken, requirePermission("items:update"), async (req, res) => {
    try {
      const repo = await repoManager.getRepository();
      const updated = await repo.updateItem(req.params.id, req.body);
      await repo.logAudit({
        action: "UPDATE_ITEM",
        entity: "Item",
        entityId: updated.id,
        userId: req.user?.userId,
        userName: req.user?.name,
        detailsJson: { sku: updated.sku, name: updated.name }
      });
      res.json({ item: updated });
    } catch (err) {
      res.status(400).json({ error: err.message || "Gagal memperbarui barang." });
    }
  });
  app.get("/api/warehouses", authenticateToken, async (req, res) => {
    try {
      const repo = await repoManager.getRepository();
      res.json({ warehouses: await repo.getWarehouses() });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app.post("/api/warehouses", authenticateToken, requirePermission("warehouses:create"), async (req, res) => {
    try {
      const { code, name, branch, address, capacityCbm } = req.body;
      if (!code || !name || !branch) {
        res.status(400).json({ error: "Kode, nama gudang, dan cabang wajib diisi." });
        return;
      }
      const repo = await repoManager.getRepository();
      const newWh = await repo.createWarehouse({
        code,
        name,
        branch,
        address: address || "",
        capacityCbm: Number(capacityCbm) || 1e3,
        isActive: true
      });
      await repo.logAudit({
        action: "CREATE_WAREHOUSE",
        entity: "Warehouse",
        entityId: newWh.id,
        userId: req.user?.userId,
        userName: req.user?.name,
        detailsJson: { code: newWh.code, name: newWh.name }
      });
      res.status(201).json({ warehouse: newWh });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });
  app.get("/api/categories", authenticateToken, async (req, res) => {
    try {
      const repo = await repoManager.getRepository();
      res.json({ categories: await repo.getCategories() });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app.get("/api/suppliers", authenticateToken, async (req, res) => {
    try {
      const repo = await repoManager.getRepository();
      res.json({ suppliers: await repo.getSuppliers() });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app.get("/api/units", authenticateToken, async (req, res) => {
    try {
      const repo = await repoManager.getRepository();
      res.json({ units: await repo.getUnits() });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app.get("/api/movements", authenticateToken, async (req, res) => {
    try {
      const { type, warehouseId, page, limit } = req.query;
      const repo = await repoManager.getRepository();
      const result = await repo.getStockMovements({
        type,
        warehouseId,
        page: page ? parseInt(page, 10) : 1,
        limit: limit ? parseInt(limit, 10) : 50
      });
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app.post("/api/movements", authenticateToken, async (req, res) => {
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
        res.status(400).json({ error: "Tipe mutasi dan daftar barang wajib diisi." });
        return;
      }
      if (type === "IN" && !hasPermission(req.user.role, "movements:in")) {
        res.status(403).json({ error: "Akses ditolak untuk transaksi barang masuk." });
        return;
      }
      if (type === "OUT" && !hasPermission(req.user.role, "movements:out")) {
        res.status(403).json({ error: "Akses ditolak untuk transaksi barang keluar." });
        return;
      }
      if (type === "TRANSFER" && !hasPermission(req.user.role, "movements:transfer")) {
        res.status(403).json({ error: "Akses ditolak untuk mutasi transfer antar gudang." });
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
        createdByUserId: req.user.userId,
        details: details.map((d) => ({
          itemId: d.itemId,
          quantity: Number(d.quantity),
          unitCost: d.unitCost !== void 0 ? Number(d.unitCost) : void 0,
          notes: d.notes
        }))
      });
      res.status(201).json({ movement });
    } catch (err) {
      console.error("[STOCK MOVEMENT ERROR]", err.message);
      res.status(400).json({ error: err.message || "Transaksi gagal diproses." });
    }
  });
  app.get("/api/assets", authenticateToken, async (req, res) => {
    try {
      const { status, condition, warehouseId, assignedToUserId, search } = req.query;
      const repo = await repoManager.getRepository();
      const assets = await repo.getAssetUnits({
        status,
        condition,
        warehouseId,
        assignedToUserId,
        search
      });
      res.json({ assets, total: assets.length });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app.get("/api/assets/:id", authenticateToken, async (req, res) => {
    try {
      const repo = await repoManager.getRepository();
      const asset = await repo.getAssetById(req.params.id);
      if (!asset) {
        res.status(404).json({ error: "Unit aset tidak ditemukan." });
        return;
      }
      res.json({ asset });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app.post("/api/assets", authenticateToken, requirePermission("assets:create"), async (req, res) => {
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
        res.status(400).json({ error: "Asset Tag, Serial Number, Item, dan Gudang wajib diisi." });
        return;
      }
      const repo = await repoManager.getRepository();
      const newAsset = await repo.createAssetUnit({
        assetTag,
        serialNumber,
        itemId,
        warehouseId,
        locationId: locationId || void 0,
        status: status || "AVAILABLE",
        condition: condition || "GOOD",
        purchaseDate: purchaseDate || void 0,
        purchaseCost: Number(purchaseCost) || 0,
        warrantyExpiry: warrantyExpiry || void 0,
        notes: notes || void 0
      });
      await repo.logAudit({
        action: "CREATE_SERIALIZED_ASSET",
        entity: "AssetUnit",
        entityId: newAsset.id,
        userId: req.user?.userId,
        userName: req.user?.name,
        detailsJson: { assetTag: newAsset.assetTag, serialNumber: newAsset.serialNumber }
      });
      res.status(201).json({ asset: newAsset });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });
  app.put("/api/assets/:id/status", authenticateToken, requirePermission("assets:assign"), async (req, res) => {
    try {
      const repo = await repoManager.getRepository();
      const updated = await repo.updateAssetStatus(req.params.id, {
        ...req.body,
        assignedByUserId: req.user?.userId
      });
      await repo.logAudit({
        action: "UPDATE_ASSET_STATUS",
        entity: "AssetUnit",
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
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });
  app.get("/api/opnames", authenticateToken, async (req, res) => {
    try {
      const repo = await repoManager.getRepository();
      res.json({ opnames: await repo.getStockOpnames() });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app.post("/api/opnames", authenticateToken, requirePermission("opname:create"), async (req, res) => {
    try {
      const { warehouseId, scheduledDate, notes, details } = req.body;
      if (!warehouseId || !scheduledDate) {
        res.status(400).json({ error: "Gudang dan tanggal jadwal stock opname wajib diisi." });
        return;
      }
      const repo = await repoManager.getRepository();
      const opname = await repo.createStockOpname({
        warehouseId,
        scheduledDate,
        status: "IN_PROGRESS",
        notes: notes || "",
        details: (details || []).map((d) => ({
          id: `opnd-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          opnameId: "",
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
        action: "CREATE_STOCK_OPNAME",
        entity: "StockOpname",
        entityId: opname.id,
        userId: req.user?.userId,
        userName: req.user?.name,
        detailsJson: { opnameNumber: opname.opnameNumber, warehouseId }
      });
      res.status(201).json({ opname });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });
  app.get("/api/requests", authenticateToken, async (req, res) => {
    try {
      const repo = await repoManager.getRepository();
      res.json({ requests: await repo.getItemRequests() });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app.post("/api/requests", authenticateToken, async (req, res) => {
    try {
      const { department, urgency, reason, details } = req.body;
      if (!reason || !details || details.length === 0) {
        res.status(400).json({ error: "Alasan permintaan dan minimal 1 item wajib diisi." });
        return;
      }
      const repo = await repoManager.getRepository();
      const newReq = await repo.createItemRequest({
        department: department || req.user?.department || "Operations",
        urgency: urgency || "NORMAL",
        status: "PENDING",
        reason,
        requestedByUserId: req.user.userId,
        details: details.map((d) => ({
          id: `ird-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          requestId: "",
          itemId: d.itemId,
          itemSku: d.itemSku,
          itemName: d.itemName,
          requestedQty: Number(d.requestedQty) || 1
        }))
      });
      await repo.logAudit({
        action: "CREATE_ITEM_REQUEST",
        entity: "ItemRequest",
        entityId: newReq.id,
        userId: req.user?.userId,
        userName: req.user?.name,
        detailsJson: { requestNumber: newReq.requestNumber, urgency: newReq.urgency }
      });
      res.status(201).json({ request: newReq });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });
  app.get("/api/users", authenticateToken, requirePermission("users:read"), async (req, res) => {
    try {
      const repo = await repoManager.getRepository();
      res.json({
        users: await repo.getUsers(),
        rolePermissions: ROLE_PERMISSIONS
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app.get("/api/audit", authenticateToken, requirePermission("audit:read"), async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit, 10) : 100;
      const repo = await repoManager.getRepository();
      res.json({ auditLogs: await repo.getAuditLogs(limit) });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app.get("/api/system/status", async (req, res) => {
    const dbHealth = await testDatabaseConnectivity();
    const maskedInfo = parseAndMaskDatabaseUrl(process.env.DATABASE_URL);
    res.json({
      systemName: "NGA Inventra Enterprise Inventory & Asset Management",
      version: "1.2.0-hostinger-ready",
      status: "OPERATIONAL",
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
        targetEngine: "MySQL 8.0+ / MariaDB 10.5+ via Prisma ORM",
        verificationState: dbHealth.status === "CONNECTED" ? "TERVERIFIKASI TERHUBUNG KE MYSQL DENGAN QUERY AKTIF (SELECT 1 & SELECT VERSION)" : "BELUM TERVERIFIKASI TERHADAP INSTANCE MYSQL EKSTERNAL (Container environment isolated)",
        migrationsReady: true,
        migrationFile: "migrations/init_mysql.sql",
        schemaFile: "prisma/schema.prisma"
      },
      security: {
        passwordHashing: "PBKDF2-SHA512 with 16-byte random salt",
        tokenType: "HMAC-SHA256 Token",
        demoBypassHardened: true,
        idempotencySupport: true,
        concurrencyLocking: true,
        negativeStockPrevention: true
      }
    });
  });
  if (!isProduction2) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path2.resolve(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path2.resolve(__dirname, "dist", "index.html"));
    });
  }
  const server = app.listen(Number(PORT), "0.0.0.0", () => {
    console.log(`[NGA INVENTRA] Server active on port ${PORT} [Mode: ${isProduction2 ? "Production" : "Development"}]`);
  });
  const shutdown = async () => {
    console.log("[NGA INVENTRA] Shutting down gracefully...");
    server.close();
    process.exit(0);
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}
startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
