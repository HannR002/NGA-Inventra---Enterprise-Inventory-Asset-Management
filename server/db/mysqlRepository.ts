import { PrismaClient } from '@prisma/client';
import { 
  User, 
  Category, 
  Unit, 
  Supplier, 
  Warehouse, 
  Item, 
  StockMovement, 
  AssetUnit, 
  StockOpname, 
  ItemRequest, 
  AuditLog, 
  StockMovementInput 
} from './types.ts';

export class PrismaMySQLRepository {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  // --- Users ---
  async findUserByEmail(email: string): Promise<User | null> {
    const u = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
    if (!u) return null;
    return {
      id: u.id,
      email: u.email,
      passwordHash: u.passwordHash,
      name: u.name,
      role: u.role as any,
      department: u.department || '',
      avatarUrl: u.avatarUrl || undefined,
      isActive: u.isActive,
      createdAt: u.createdAt.toISOString(),
      updatedAt: u.updatedAt ? u.updatedAt.toISOString() : u.createdAt.toISOString(),
    };
  }

  async findUserById(id: string): Promise<User | null> {
    const u = await this.prisma.user.findUnique({
      where: { id },
    });
    if (!u) return null;
    return {
      id: u.id,
      email: u.email,
      passwordHash: u.passwordHash,
      name: u.name,
      role: u.role as any,
      department: u.department || '',
      avatarUrl: u.avatarUrl || undefined,
      isActive: u.isActive,
      createdAt: u.createdAt.toISOString(),
      updatedAt: u.updatedAt ? u.updatedAt.toISOString() : u.createdAt.toISOString(),
    };
  }

  async updateUserPassword(id: string, newPasswordHash: string): Promise<void> {
    await this.prisma.user.update({
      where: { id },
      data: { passwordHash: newPasswordHash },
    });
  }

  async getUsers(): Promise<User[]> {
    const users = await this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return users.map(u => ({
      id: u.id,
      email: u.email,
      passwordHash: '', // never expose passwordHash
      name: u.name,
      role: u.role as any,
      department: u.department || '',
      avatarUrl: u.avatarUrl || undefined,
      isActive: u.isActive,
      createdAt: u.createdAt.toISOString(),
      updatedAt: u.updatedAt ? u.updatedAt.toISOString() : u.createdAt.toISOString(),
    }));
  }

  // --- Categories, Units, Suppliers ---
  async getCategories(): Promise<Category[]> {
    const list = await this.prisma.category.findMany({ orderBy: { name: 'asc' } });
    return list.map(c => ({
      id: c.id,
      code: c.code,
      name: c.name,
      description: c.description || '',
      createdAt: c.createdAt.toISOString(),
    }));
  }

  async getUnits(): Promise<Unit[]> {
    const list = await this.prisma.unit.findMany({ orderBy: { name: 'asc' } });
    return list.map(u => ({
      id: u.id,
      name: u.name,
      symbol: u.symbol,
      description: u.description || undefined,
    }));
  }

  async getSuppliers(): Promise<Supplier[]> {
    const list = await this.prisma.supplier.findMany({ orderBy: { name: 'asc' } });
    return list.map(s => ({
      id: s.id,
      code: s.code,
      name: s.name,
      contactName: s.contactName || '',
      email: s.email || '',
      phone: s.phone || '',
      address: s.address || '',
      city: s.city || '',
      rating: s.rating,
      isActive: s.isActive,
      createdAt: s.createdAt.toISOString(),
    }));
  }

  // --- Warehouses ---
  async getWarehouses(): Promise<Warehouse[]> {
    const list = await this.prisma.warehouse.findMany({ orderBy: { name: 'asc' } });
    return list.map(w => ({
      id: w.id,
      code: w.code,
      name: w.name,
      branch: w.branch,
      address: w.address,
      capacityCbm: w.capacityCbm,
      managerId: w.managerId || undefined,
      isActive: w.isActive,
      createdAt: w.createdAt.toISOString(),
    }));
  }

  async createWarehouse(input: Omit<Warehouse, 'id' | 'createdAt'>): Promise<Warehouse> {
    const id = `wh-${input.code.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
    const created = await this.prisma.warehouse.create({
      data: {
        id,
        code: input.code.toUpperCase(),
        name: input.name,
        branch: input.branch,
        address: input.address,
        capacityCbm: input.capacityCbm || 1000,
        managerId: input.managerId || null,
        isActive: input.isActive ?? true,
      },
    });
    return {
      id: created.id,
      code: created.code,
      name: created.name,
      branch: created.branch,
      address: created.address,
      capacityCbm: created.capacityCbm,
      managerId: created.managerId || undefined,
      isActive: created.isActive,
      createdAt: created.createdAt.toISOString(),
    };
  }

  // --- Items & Inventory ---
  async getItems(options: {
    search?: string;
    categoryId?: string;
    itemType?: string;
    stockStatus?: 'ALL' | 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';
    page?: number;
    limit?: number;
  } = {}): Promise<{ items: Item[]; total: number; page: number; limit: number; totalPages: number }> {
    const page = options.page || 1;
    const limit = options.limit || 50;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (options.search) {
      where.OR = [
        { name: { contains: options.search } },
        { sku: { contains: options.search } },
        { barcode: { contains: options.search } },
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
          stockBalances: true,
        },
        orderBy: { updatedAt: 'desc' },
      }),
    ]);

    const items: Item[] = rows.map(r => ({
      id: r.id,
      sku: r.sku,
      barcode: r.barcode || '',
      name: r.name,
      description: r.description || '',
      categoryId: r.categoryId,
      categoryName: r.category?.name,
      unitId: r.unitId,
      unitSymbol: r.unit?.symbol,
      supplierId: r.supplierId || undefined,
      supplierName: r.supplier?.name,
      itemType: r.itemType as any,
      currentStock: r.currentStock,
      minStock: r.minStock,
      maxStock: r.maxStock,
      reorderPoint: r.reorderPoint,
      safetyStock: r.safetyStock,
      unitCost: Number(r.unitCost),
      unitPrice: Number(r.unitPrice),
      specifications: (r.specifications as any) || {},
      imageUrl: r.imageUrl || undefined,
      isActive: r.isActive,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
      stockBalances: r.stockBalances.map(sb => ({
        id: sb.id,
        itemId: sb.itemId,
        warehouseId: sb.warehouseId,
        quantity: sb.quantity,
        reservedQty: sb.reservedQty,
        updatedAt: sb.updatedAt.toISOString(),
      })),
    }));

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async getItemById(id: string): Promise<Item | null> {
    const r = await this.prisma.item.findUnique({
      where: { id },
      include: {
        category: true,
        unit: true,
        supplier: true,
        stockBalances: {
          include: {
            warehouse: true,
          },
        },
      },
    });

    if (!r) return null;

    return {
      id: r.id,
      sku: r.sku,
      barcode: r.barcode || '',
      name: r.name,
      description: r.description || '',
      categoryId: r.categoryId,
      categoryName: r.category?.name,
      unitId: r.unitId,
      unitSymbol: r.unit?.symbol,
      supplierId: r.supplierId || undefined,
      supplierName: r.supplier?.name,
      itemType: r.itemType as any,
      currentStock: r.currentStock,
      minStock: r.minStock,
      maxStock: r.maxStock,
      reorderPoint: r.reorderPoint,
      safetyStock: r.safetyStock,
      unitCost: Number(r.unitCost),
      unitPrice: Number(r.unitPrice),
      specifications: (r.specifications as any) || {},
      imageUrl: r.imageUrl || undefined,
      isActive: r.isActive,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
      stockBalances: r.stockBalances.map(sb => ({
        id: sb.id,
        itemId: sb.itemId,
        warehouseId: sb.warehouseId,
        warehouseName: sb.warehouse?.name,
        quantity: sb.quantity,
        reservedQty: sb.reservedQty,
        updatedAt: sb.updatedAt.toISOString(),
      })),
    };
  }

  async createItem(input: Omit<Item, 'id' | 'createdAt' | 'updatedAt'>): Promise<Item> {
    const id = `itm-${input.sku.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
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
        itemType: input.itemType || 'CONSUMABLE',
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
            quantity: idx === 0 ? (input.currentStock || 0) : 0,
            reservedQty: 0,
          })),
        },
      },
      include: {
        category: true,
        unit: true,
        supplier: true,
        stockBalances: true,
      },
    });

    return {
      id: created.id,
      sku: created.sku,
      barcode: created.barcode || '',
      name: created.name,
      description: created.description || '',
      categoryId: created.categoryId,
      categoryName: created.category?.name,
      unitId: created.unitId,
      unitSymbol: created.unit?.symbol,
      supplierId: created.supplierId || undefined,
      supplierName: created.supplier?.name,
      itemType: created.itemType as any,
      currentStock: created.currentStock,
      minStock: created.minStock,
      maxStock: created.maxStock,
      reorderPoint: created.reorderPoint,
      safetyStock: created.safetyStock,
      unitCost: Number(created.unitCost),
      unitPrice: Number(created.unitPrice),
      specifications: (created.specifications as any) || {},
      imageUrl: created.imageUrl || undefined,
      isActive: created.isActive,
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
      stockBalances: created.stockBalances.map(sb => ({
        id: sb.id,
        itemId: sb.itemId,
        warehouseId: sb.warehouseId,
        quantity: sb.quantity,
        reservedQty: sb.reservedQty,
        updatedAt: sb.updatedAt.toISOString(),
      })),
    };
  }

  async updateItem(id: string, updates: Partial<Item>): Promise<Item> {
    const updated = await this.prisma.item.update({
      where: { id },
      data: {
        ...(updates.name ? { name: updates.name } : {}),
        ...(updates.description !== undefined ? { description: updates.description } : {}),
        ...(updates.barcode !== undefined ? { barcode: updates.barcode } : {}),
        ...(updates.minStock !== undefined ? { minStock: updates.minStock } : {}),
        ...(updates.maxStock !== undefined ? { maxStock: updates.maxStock } : {}),
        ...(updates.reorderPoint !== undefined ? { reorderPoint: updates.reorderPoint } : {}),
        ...(updates.safetyStock !== undefined ? { safetyStock: updates.safetyStock } : {}),
        ...(updates.unitCost !== undefined ? { unitCost: updates.unitCost } : {}),
        ...(updates.unitPrice !== undefined ? { unitPrice: updates.unitPrice } : {}),
        ...(updates.specifications !== undefined ? { specifications: updates.specifications } : {}),
        ...(updates.isActive !== undefined ? { isActive: updates.isActive } : {}),
      },
      include: {
        category: true,
        unit: true,
        supplier: true,
        stockBalances: true,
      },
    });

    return {
      id: updated.id,
      sku: updated.sku,
      barcode: updated.barcode || '',
      name: updated.name,
      description: updated.description || '',
      categoryId: updated.categoryId,
      categoryName: updated.category?.name,
      unitId: updated.unitId,
      unitSymbol: updated.unit?.symbol,
      supplierId: updated.supplierId || undefined,
      supplierName: updated.supplier?.name,
      itemType: updated.itemType as any,
      currentStock: updated.currentStock,
      minStock: updated.minStock,
      maxStock: updated.maxStock,
      reorderPoint: updated.reorderPoint,
      safetyStock: updated.safetyStock,
      unitCost: Number(updated.unitCost),
      unitPrice: Number(updated.unitPrice),
      specifications: (updated.specifications as any) || {},
      imageUrl: updated.imageUrl || undefined,
      isActive: updated.isActive,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  // --- ATOMIC STOCK MUTATIONS (Goods In, Out, Transfer) ---
  async executeStockMovement(input: StockMovementInput): Promise<StockMovement> {
    // 1. Idempotency Check
    if (input.idempotencyKey) {
      const existing = await this.prisma.stockMovement.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
        include: { details: true },
      });
      if (existing) {
        return this.mapStockMovement(existing);
      }
    }

    // 2. Execute within an ACID Prisma Interactive Transaction
    return await this.prisma.$transaction(async (tx) => {
      // Validate warehouses
      if (input.type === 'IN' && !input.targetWarehouseId) {
        throw new Error('Gudang tujuan wajib ditentukan untuk transaksi barang masuk (IN).');
      }
      if (input.type === 'OUT' && !input.sourceWarehouseId) {
        throw new Error('Gudang asal wajib ditentukan untuk transaksi barang keluar (OUT).');
      }
      if (input.type === 'TRANSFER' && (!input.sourceWarehouseId || !input.targetWarehouseId)) {
        throw new Error('Gudang asal dan tujuan wajib ditentukan untuk mutasi transfer.');
      }
      if (input.type === 'TRANSFER' && input.sourceWarehouseId === input.targetWarehouseId) {
        throw new Error('Gudang asal dan tujuan tidak boleh sama.');
      }

      const movementId = `mov-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
      const movementNumber = `MOV-${new Date().toISOString().slice(0, 7).replace('-', '')}-${Math.floor(1000 + Math.random() * 9000)}`;

      // Step A: Stock validation & updates
      for (const d of input.details) {
        const item = await tx.item.findUnique({
          where: { id: d.itemId },
          select: { id: true, name: true, sku: true, currentStock: true, unitCost: true },
        });

        if (!item) {
          throw new Error(`Item ID "${d.itemId}" tidak ditemukan di database.`);
        }

        const quantity = d.quantity;
        if (quantity <= 0) {
          throw new Error(`Kuantitas untuk "${item.name}" harus lebih besar dari 0.`);
        }

        // Handle Goods Out: Check source balance
        if (input.type === 'OUT') {
          const sourceBal = await tx.stockBalance.findUnique({
            where: {
              itemId_warehouseId: {
                itemId: d.itemId,
                warehouseId: input.sourceWarehouseId!,
              },
            },
          });

          const availableQty = sourceBal ? (sourceBal.quantity - sourceBal.reservedQty) : 0;
          if (availableQty < quantity) {
            throw new Error(`Stok tidak mencukupi untuk item "${item.name}" (${item.sku}). Tersedia: ${availableQty}, Diminta: ${quantity}`);
          }

          // Deduct from balance
          await tx.stockBalance.update({
            where: { id: sourceBal!.id },
            data: { quantity: { decrement: quantity } },
          });

          // Deduct from overall item currentStock
          await tx.item.update({
            where: { id: item.id },
            data: { currentStock: { decrement: quantity } },
          });
        }

        // Handle Goods In: Increment target balance
        else if (input.type === 'IN') {
          await tx.stockBalance.upsert({
            where: {
              itemId_warehouseId: {
                itemId: d.itemId,
                warehouseId: input.targetWarehouseId!,
              },
            },
            create: {
              id: `sb-${d.itemId}-${input.targetWarehouseId}`,
              itemId: d.itemId,
              warehouseId: input.targetWarehouseId!,
              quantity: quantity,
              reservedQty: 0,
            },
            update: {
              quantity: { increment: quantity },
            },
          });

          await tx.item.update({
            where: { id: item.id },
            data: { currentStock: { increment: quantity } },
          });
        }

        // Handle Transfer: Source to Target
        else if (input.type === 'TRANSFER') {
          const sourceBal = await tx.stockBalance.findUnique({
            where: {
              itemId_warehouseId: {
                itemId: d.itemId,
                warehouseId: input.sourceWarehouseId!,
              },
            },
          });

          const availableQty = sourceBal ? (sourceBal.quantity - sourceBal.reservedQty) : 0;
          if (availableQty < quantity) {
            throw new Error(`Stok tidak mencukupi di gudang asal untuk item "${item.name}". Tersedia: ${availableQty}, Diminta: ${quantity}`);
          }

          // Decrement source
          await tx.stockBalance.update({
            where: { id: sourceBal!.id },
            data: { quantity: { decrement: quantity } },
          });

          // Increment target
          await tx.stockBalance.upsert({
            where: {
              itemId_warehouseId: {
                itemId: d.itemId,
                warehouseId: input.targetWarehouseId!,
              },
            },
            create: {
              id: `sb-${d.itemId}-${input.targetWarehouseId}`,
              itemId: d.itemId,
              warehouseId: input.targetWarehouseId!,
              quantity: quantity,
              reservedQty: 0,
            },
            update: {
              quantity: { increment: quantity },
            },
          });
          // Note: Overall currentStock remains unchanged during warehouse transfer
        }
      }

      // Step B: Create movement record
      const createdMovement = await tx.stockMovement.create({
        data: {
          id: movementId,
          movementNumber,
          type: input.type,
          status: 'COMPLETED',
          sourceWarehouseId: input.sourceWarehouseId || null,
          targetWarehouseId: input.targetWarehouseId || null,
          supplierId: input.supplierId || null,
          referenceDoc: input.referenceDoc || null,
          idempotencyKey: input.idempotencyKey || null,
          notes: input.notes || null,
          createdByUserId: input.createdByUserId,
          details: {
            create: input.details.map((d: any, idx: number) => ({
              id: `smd-${movementId}-${idx}`,
              itemId: d.itemId,
              quantity: d.quantity,
              unitCost: d.unitCost ?? 0,
              subtotal: (d.quantity) * (d.unitCost ?? 0),
              notes: d.notes || null,
            })),
          },
        },
        include: {
          details: true,
          sourceWarehouse: true,
          targetWarehouse: true,
          createdByUser: true,
        },
      });

      // Step C: Log audit entry
      await tx.auditLog.create({
        data: {
          id: `aud-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          action: `STOCK_${input.type}`,
          entity: 'StockMovement',
          entityId: createdMovement.id,
          userId: input.createdByUserId,
          userName: createdMovement.createdByUser?.name || 'System User',
          detailsJson: {
            movementNumber,
            type: input.type,
            sourceWarehouse: createdMovement.sourceWarehouse?.name,
            targetWarehouse: createdMovement.targetWarehouse?.name,
            itemCount: input.details.length,
          },
        },
      });

      return this.mapStockMovement(createdMovement);
    });
  }

  async getStockMovements(options: {
    type?: string;
    warehouseId?: string;
    page?: number;
    limit?: number;
  } = {}): Promise<{ movements: StockMovement[]; total: number; page: number; limit: number; totalPages: number }> {
    const page = options.page || 1;
    const limit = options.limit || 50;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (options.type) where.type = options.type;
    if (options.warehouseId) {
      where.OR = [
        { sourceWarehouseId: options.warehouseId },
        { targetWarehouseId: options.warehouseId },
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
              item: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      movements: rows.map(r => this.mapStockMovement(r)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  // --- Serialized Assets ---
  async getAssetUnits(filter: {
    status?: string;
    condition?: string;
    warehouseId?: string;
    assignedToUserId?: string;
    search?: string;
  } = {}): Promise<AssetUnit[]> {
    const where: any = {};
    if (filter.status) where.status = filter.status;
    if (filter.condition) where.condition = filter.condition;
    if (filter.warehouseId) where.warehouseId = filter.warehouseId;
    if (filter.assignedToUserId) where.assignedToUserId = filter.assignedToUserId;
    if (filter.search) {
      where.OR = [
        { assetTag: { contains: filter.search } },
        { serialNumber: { contains: filter.search } },
      ];
    }

    const rows = await this.prisma.assetUnit.findMany({
      where,
      include: {
        item: true,
        warehouse: true,
        assignedToUser: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return rows.map(r => ({
      id: r.id,
      assetTag: r.assetTag,
      serialNumber: r.serialNumber,
      itemId: r.itemId,
      itemName: r.item?.name,
      itemSku: r.item?.sku,
      warehouseId: r.warehouseId,
      warehouseName: r.warehouse?.name,
      status: r.status as any,
      condition: r.condition as any,
      assignedToUserId: r.assignedToUserId || undefined,
      assignedToUserName: r.assignedToUser?.name,
      department: r.department || undefined,
      purchaseDate: r.purchaseDate ? r.purchaseDate.toISOString() : undefined,
      purchaseCost: Number(r.purchaseCost),
      warrantyExpiry: r.warrantyExpiry ? r.warrantyExpiry.toISOString() : undefined,
      notes: r.notes || undefined,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }));
  }

  async getAssetById(id: string): Promise<AssetUnit | null> {
    const r = await this.prisma.assetUnit.findUnique({
      where: { id },
      include: {
        item: true,
        warehouse: true,
        assignedToUser: true,
        assignments: {
          include: {
            assignedToUser: true,
            assignedByUser: true,
          },
          orderBy: { assignedAt: 'desc' },
        },
      },
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
      status: r.status as any,
      condition: r.condition as any,
      assignedToUserId: r.assignedToUserId || undefined,
      assignedToUserName: r.assignedToUser?.name,
      department: r.department || undefined,
      purchaseDate: r.purchaseDate ? r.purchaseDate.toISOString() : undefined,
      purchaseCost: Number(r.purchaseCost),
      warrantyExpiry: r.warrantyExpiry ? r.warrantyExpiry.toISOString() : undefined,
      notes: r.notes || undefined,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    };
  }

  async createAssetUnit(input: Omit<AssetUnit, 'id' | 'createdAt' | 'updatedAt'>): Promise<AssetUnit> {
    // Verify item is SERIALIZED_ASSET
    const item = await this.prisma.item.findUnique({ where: { id: input.itemId } });
    if (!item) throw new Error('Item tidak ditemukan.');
    if (item.itemType !== 'SERIALIZED_ASSET') {
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
        status: (input.status as any) || 'AVAILABLE',
        condition: (input.condition as any) || 'GOOD',
        purchaseCost: input.purchaseCost || 0,
        purchaseDate: input.purchaseDate ? new Date(input.purchaseDate) : null,
        warrantyExpiry: input.warrantyExpiry ? new Date(input.warrantyExpiry) : null,
        notes: input.notes || null,
      },
      include: {
        item: true,
        warehouse: true,
      },
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
      status: created.status as any,
      condition: created.condition as any,
      purchaseCost: Number(created.purchaseCost),
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
    };
  }

  async updateAssetStatus(id: string, updates: {
    status: any;
    condition?: any;
    assignedToUserId?: string;
    department?: string;
    notes?: string;
    assignedByUserId?: string;
  }): Promise<AssetUnit> {
    const updated = await this.prisma.assetUnit.update({
      where: { id },
      data: {
        status: updates.status,
        ...(updates.condition ? { condition: updates.condition } : {}),
        assignedToUserId: updates.assignedToUserId || null,
        department: updates.department || null,
        notes: updates.notes || null,
      },
      include: {
        item: true,
        warehouse: true,
        assignedToUser: true,
      },
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
      status: updated.status as any,
      condition: updated.condition as any,
      assignedToUserId: updated.assignedToUserId || undefined,
      assignedToUserName: updated.assignedToUser?.name,
      department: updated.department || undefined,
      purchaseCost: Number(updated.purchaseCost),
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  // --- Stock Opnames ---
  async getStockOpnames(): Promise<StockOpname[]> {
    const list = await this.prisma.stockOpname.findMany({
      include: {
        warehouse: true,
        details: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return list.map(o => ({
      id: o.id,
      opnameNumber: o.opnameNumber,
      warehouseId: o.warehouseId,
      warehouseName: o.warehouse?.name,
      scheduledDate: o.scheduledDate.toISOString().slice(0, 10),
      status: o.status as any,
      notes: o.notes || undefined,
      createdAt: o.createdAt.toISOString(),
      totalItemsCount: o.details.length,
      discrepancyCount: o.details.filter(d => d.difference !== 0).length,
      discrepancyValueTotal: o.details.reduce((sum, d) => sum + Number(d.discrepancyValue), 0),
      details: o.details.map(d => ({
        id: d.id,
        opnameId: d.opnameId,
        itemId: d.itemId,
        itemSku: '',
        itemName: '',
        systemStock: d.systemStock,
        physicalStock: d.physicalStock,
        difference: d.difference,
        unitCost: Number(d.unitCost),
        discrepancyValue: Number(d.discrepancyValue),
        notes: d.notes || undefined,
      })),
    }));
  }

  async createStockOpname(input: Omit<StockOpname, 'id' | 'opnameNumber' | 'createdAt'>): Promise<StockOpname> {
    const opnameId = `opn-${Date.now()}`;
    const opnameNumber = `OPN-${new Date().toISOString().slice(0, 7).replace('-', '')}-${Math.floor(10 + Math.random() * 90)}`;

    const created = await this.prisma.stockOpname.create({
      data: {
        id: opnameId,
        opnameNumber,
        warehouseId: input.warehouseId,
        scheduledDate: new Date(input.scheduledDate),
        status: (input.status as any) || 'IN_PROGRESS',
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
            notes: d.notes || null,
          })),
        },
      },
      include: {
        warehouse: true,
        details: true,
      },
    });

    return {
      id: created.id,
      opnameNumber: created.opnameNumber,
      warehouseId: created.warehouseId,
      warehouseName: created.warehouse?.name,
      scheduledDate: created.scheduledDate.toISOString().slice(0, 10),
      status: created.status as any,
      notes: created.notes || undefined,
      createdAt: created.createdAt.toISOString(),
      details: input.details,
    };
  }

  // --- Item Requests ---
  async getItemRequests(): Promise<ItemRequest[]> {
    const list = await this.prisma.itemRequest.findMany({
      include: {
        requestedByUser: true,
        approvedByUser: true,
        details: {
          include: {
            item: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return list.map(r => ({
      id: r.id,
      requestNumber: r.requestNumber,
      department: r.department,
      urgency: r.urgency as any,
      status: r.status as any,
      reason: r.reason,
      requestedByUserId: r.requestedByUserId,
      requestedByUserName: r.requestedByUser?.name,
      approvedByUserId: r.approvedByUserId || undefined,
      approvedByUserName: r.approvedByUser?.name,
      approvedAt: r.approvedAt ? r.approvedAt.toISOString() : undefined,
      rejectionReason: r.rejectionReason || undefined,
      createdAt: r.createdAt.toISOString(),
      details: r.details.map(d => ({
        id: d.id,
        requestId: d.requestId,
        itemId: d.itemId,
        itemSku: d.item?.sku || '',
        itemName: d.item?.name || '',
        requestedQty: d.requestedQty,
        approvedQty: d.approvedQty || undefined,
      })),
    }));
  }

  async createItemRequest(input: Omit<ItemRequest, 'id' | 'requestNumber' | 'createdAt'>): Promise<ItemRequest> {
    const id = `req-${Date.now()}`;
    const requestNumber = `REQ-${new Date().toISOString().slice(0, 7).replace('-', '')}-${Math.floor(100 + Math.random() * 900)}`;

    const created = await this.prisma.itemRequest.create({
      data: {
        id,
        requestNumber,
        department: input.department,
        urgency: (input.urgency as any) || 'NORMAL',
        status: (input.status as any) || 'PENDING',
        reason: input.reason,
        requestedByUserId: input.requestedByUserId,
        details: {
          create: input.details.map((d, idx) => ({
            id: `ird-${id}-${idx}`,
            itemId: d.itemId,
            requestedQty: d.requestedQty,
          })),
        },
      },
      include: {
        requestedByUser: true,
        details: true,
      },
    });

    return {
      id: created.id,
      requestNumber: created.requestNumber,
      department: created.department,
      urgency: created.urgency as any,
      status: created.status as any,
      reason: created.reason,
      requestedByUserId: created.requestedByUserId,
      requestedByName: created.requestedByUser?.name,
      createdAt: created.createdAt.toISOString(),
      details: input.details,
    };
  }

  // --- Audit Logs ---
  async getAuditLogs(limit = 100): Promise<AuditLog[]> {
    const list = await this.prisma.auditLog.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        user: true,
      },
    });

    return list.map(l => ({
      id: l.id,
      action: l.action,
      entity: l.entity,
      entityId: l.entityId || undefined,
      userId: l.userId || undefined,
      userName: l.userName || l.user?.name || 'System',
      ipAddress: l.ipAddress || '127.0.0.1',
      detailsJson: l.detailsJson as any,
      createdAt: l.createdAt.toISOString(),
    }));
  }

  async logAudit(entry: {
    action: string;
    entity: string;
    entityId?: string;
    userId?: string;
    userName?: string;
    ipAddress?: string;
    detailsJson?: any;
  }): Promise<AuditLog> {
    const id = `aud-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    const created = await this.prisma.auditLog.create({
      data: {
        id,
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId || null,
        userId: entry.userId || null,
        userName: entry.userName || null,
        ipAddress: entry.ipAddress || '127.0.0.1',
        detailsJson: entry.detailsJson || null,
      },
    });

    return {
      id: created.id,
      action: created.action,
      entity: created.entity,
      entityId: created.entityId || undefined,
      userId: created.userId || undefined,
      userName: created.userName || undefined,
      ipAddress: created.ipAddress || undefined,
      detailsJson: created.detailsJson as any,
      createdAt: created.createdAt.toISOString(),
    };
  }

  private mapStockMovement(r: any): StockMovement {
    return {
      id: r.id,
      movementNumber: r.movementNumber,
      type: r.type as any,
      status: r.status as any,
      sourceWarehouseId: r.sourceWarehouseId || undefined,
      sourceWarehouseName: r.sourceWarehouse?.name,
      targetWarehouseId: r.targetWarehouseId || undefined,
      targetWarehouseName: r.targetWarehouse?.name,
      supplierId: r.supplierId || undefined,
      supplierName: r.supplier?.name,
      referenceDoc: r.referenceDoc || undefined,
      idempotencyKey: r.idempotencyKey || undefined,
      notes: r.notes || undefined,
      createdByUserId: r.createdByUserId,
      createdByName: r.createdByUser?.name || 'Staff',
      approvedByUserId: r.approvedByUserId || undefined,
      approvedByName: r.approvedByUser?.name,
      createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : new Date().toISOString(),
      details: (r.details || []).map((d: any) => ({
        id: d.id,
        movementId: d.movementId,
        itemId: d.itemId,
        itemSku: d.item?.sku || '',
        itemName: d.item?.name || '',
        quantity: d.quantity,
        unitCost: Number(d.unitCost || 0),
        subtotal: Number(d.subtotal || 0),
        notes: d.notes || undefined,
      })),
    };
  }
}
