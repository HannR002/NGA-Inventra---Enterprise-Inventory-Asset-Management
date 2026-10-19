import fs from 'fs';
import path from 'path';
import type { 
  User, 
  Category, 
  Unit, 
  Supplier, 
  Warehouse, 
  WarehouseLocation, 
  Item, 
  StockBalance, 
  AssetUnit, 
  AssetAssignment, 
  StockMovement, 
  StockMovementDetail,
  StockOpname, 
  StockOpnameDetail,
  ItemRequest, 
  AuditLog,
  MovementType
} from './types.ts';
import { getInitialSeedData } from './seedData.ts';

interface DatabaseSchema {
  users: User[];
  categories: Category[];
  units: Unit[];
  suppliers: Supplier[];
  warehouses: Warehouse[];
  locations: WarehouseLocation[];
  items: Item[];
  stockBalances: StockBalance[];
  assetUnits: AssetUnit[];
  assetAssignments: AssetAssignment[];
  stockMovements: StockMovement[];
  stockOpnames: StockOpname[];
  itemRequests: ItemRequest[];
  auditLogs: AuditLog[];
}

const DATA_DIR = path.resolve(process.cwd(), '.data');
const DB_FILE = path.join(DATA_DIR, 'inventra-db.json');

// Concurrency lock simulation
let isLocked = false;
async function acquireLock(timeoutMs = 5000): Promise<void> {
  const start = Date.now();
  while (isLocked) {
    if (Date.now() - start > timeoutMs) {
      throw new Error('Database transaction lock timeout');
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  isLocked = true;
}

function releaseLock(): void {
  isLocked = false;
}

export class DatabaseStore {
  private data: DatabaseSchema;

  constructor() {
    this.ensureDataDir();
    this.data = this.loadData();
  }

  private ensureDataDir(): void {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  }

  private loadData(): DatabaseSchema {
    if (fs.existsSync(DB_FILE)) {
      try {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        return JSON.parse(raw);
      } catch (err) {
        console.warn('Failed to read db file, re-seeding...', err);
      }
    }

    const seed = getInitialSeedData();
    const initial: DatabaseSchema = {
      ...seed,
      assetAssignments: [],
      stockOpnames: [],
      itemRequests: []
    };
    this.saveDataDirect(initial);
    return initial;
  }

  private saveDataDirect(data: DatabaseSchema): void {
    try {
      this.ensureDataDir();
      fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
    } catch (err) {
      console.error('Error persisting database to disk:', err);
    }
  }

  public async persist(): Promise<void> {
    this.saveDataDirect(this.data);
  }

  public resetToSeed(): DatabaseSchema {
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

  // --- Transaction Runner with Atomic Rollback ---
  public async runTransaction<T>(fn: (db: DatabaseStore) => Promise<T>): Promise<T> {
    await acquireLock();
    // Snapshot state for atomic rollback on failure
    const snapshot = JSON.stringify(this.data);
    try {
      const result = await fn(this);
      await this.persist();
      return result;
    } catch (err) {
      // Rollback memory state to pre-transaction snapshot
      this.data = JSON.parse(snapshot);
      throw err;
    } finally {
      releaseLock();
    }
  }

  // --- Audit Trail Logging ---
  public logAudit(entry: {
    action: string;
    entity: string;
    entityId?: string;
    userId?: string;
    userName?: string;
    ipAddress?: string;
    detailsJson?: any;
  }): AuditLog {
    const newLog: AuditLog = {
      id: `aud-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId,
      userId: entry.userId,
      userName: entry.userName,
      ipAddress: entry.ipAddress || '127.0.0.1',
      detailsJson: entry.detailsJson,
      createdAt: new Date().toISOString(),
    };
    this.data.auditLogs.unshift(newLog);
    return newLog;
  }

  // --- Users ---
  public getUsers(): User[] {
    return this.data.users.map(({ passwordHash, ...rest }) => rest as User);
  }

  public findUserByEmail(email: string): User | undefined {
    return this.data.users.find(u => u.email.toLowerCase() === email.toLowerCase());
  }

  public findUserById(id: string): User | undefined {
    return this.data.users.find(u => u.id === id);
  }

  public updateUserPassword(id: string, newPasswordHash: string): void {
    const user = this.data.users.find(u => u.id === id);
    if (user) {
      user.passwordHash = newPasswordHash;
      user.updatedAt = new Date().toISOString();
      this.persist();
    }
  }

  // --- Categories & Units ---
  public getCategories(): Category[] {
    return this.data.categories;
  }

  public getUnits(): Unit[] {
    return this.data.units;
  }

  public getSuppliers(): Supplier[] {
    return this.data.suppliers;
  }

  // --- Warehouses ---
  public getWarehouses(): Warehouse[] {
    return this.data.warehouses;
  }

  public getWarehouseById(id: string): Warehouse | undefined {
    return this.data.warehouses.find(w => w.id === id);
  }

  public createWarehouse(input: Omit<Warehouse, 'id' | 'createdAt'>): Warehouse {
    const id = `wh-${input.code.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
    const newWarehouse: Warehouse = {
      ...input,
      id,
      createdAt: new Date().toISOString(),
    };
    this.data.warehouses.push(newWarehouse);
    return newWarehouse;
  }

  // --- Items ---
  public getItems(filters?: {
    search?: string;
    categoryId?: string;
    itemType?: string;
    stockStatus?: 'low' | 'out' | 'normal';
    page?: number;
    limit?: number;
  }): { items: Item[]; total: number; page: number; limit: number } {
    let list = this.data.items.map(item => {
      // Attach current stock balances per warehouse
      const balances = this.data.stockBalances.filter(sb => sb.itemId === item.id);
      return {
        ...item,
        stockBalances: balances
      };
    });

    if (filters?.search) {
      const q = filters.search.toLowerCase();
      list = list.filter(i => 
        i.name.toLowerCase().includes(q) || 
        i.sku.toLowerCase().includes(q) || 
        (i.barcode && i.barcode.includes(q))
      );
    }

    if (filters?.categoryId) {
      list = list.filter(i => i.categoryId === filters.categoryId);
    }

    if (filters?.itemType) {
      list = list.filter(i => i.itemType === filters.itemType);
    }

    if (filters?.stockStatus) {
      if (filters.stockStatus === 'low') {
        list = list.filter(i => i.currentStock <= i.minStock && i.currentStock > 0);
      } else if (filters.stockStatus === 'out') {
        list = list.filter(i => i.currentStock <= 0);
      } else if (filters.stockStatus === 'normal') {
        list = list.filter(i => i.currentStock > i.minStock);
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

  public getItemById(id: string): Item | undefined {
    const item = this.data.items.find(i => i.id === id || i.sku === id);
    if (!item) return undefined;
    const balances = this.data.stockBalances.filter(sb => sb.itemId === item.id);
    return {
      ...item,
      stockBalances: balances
    };
  }

  public createItem(input: Omit<Item, 'id' | 'createdAt' | 'updatedAt' | 'stockBalances'>): Item {
    // Check SKU unique
    if (this.data.items.some(i => i.sku.toLowerCase() === input.sku.toLowerCase())) {
      throw new Error(`SKU '${input.sku}' sudah terdaftar dalam sistem.`);
    }

    const id = `itm-${Date.now()}`;
    const category = this.data.categories.find(c => c.id === input.categoryId);
    const unit = this.data.units.find(u => u.id === input.unitId);
    const supplier = input.supplierId ? this.data.suppliers.find(s => s.id === input.supplierId) : undefined;

    const newItem: Item = {
      ...input,
      id,
      categoryName: category?.name,
      unitSymbol: unit?.symbol,
      supplierName: supplier?.name,
      currentStock: input.currentStock || 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.data.items.push(newItem);

    // Initialize stock balance in default warehouse if initial stock > 0
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
          updatedAt: new Date().toISOString()
        });
      }
    }

    return newItem;
  }

  public updateItem(id: string, updates: Partial<Item>): Item {
    const idx = this.data.items.findIndex(i => i.id === id);
    if (idx === -1) {
      throw new Error(`Barang dengan ID '${id}' tidak ditemukan.`);
    }

    const current = this.data.items[idx];
    const updated: Item = {
      ...current,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    if (updates.categoryId && updates.categoryId !== current.categoryId) {
      const cat = this.data.categories.find(c => c.id === updates.categoryId);
      updated.categoryName = cat?.name;
    }
    if (updates.unitId && updates.unitId !== current.unitId) {
      const unit = this.data.units.find(u => u.id === updates.unitId);
      updated.unitSymbol = unit?.symbol;
    }

    this.data.items[idx] = updated;
    return updated;
  }

  // --- Stock Balances ---
  public getStockBalance(itemId: string, warehouseId: string): StockBalance | undefined {
    return this.data.stockBalances.find(sb => sb.itemId === itemId && sb.warehouseId === warehouseId);
  }

  public setStockBalance(itemId: string, warehouseId: string, quantity: number): StockBalance {
    if (quantity < 0) {
      throw new Error('Stock balance quantity cannot be negative.');
    }
    let balance = this.data.stockBalances.find(sb => sb.itemId === itemId && sb.warehouseId === warehouseId);
    const wh = this.data.warehouses.find(w => w.id === warehouseId);

    if (balance) {
      balance.quantity = quantity;
      balance.updatedAt = new Date().toISOString();
    } else {
      balance = {
        id: `sb-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        itemId,
        warehouseId,
        warehouseCode: wh?.code,
        warehouseName: wh?.name,
        quantity,
        reservedQty: 0,
        updatedAt: new Date().toISOString()
      };
      this.data.stockBalances.push(balance);
    }
    return balance;
  }

  // --- Atomic Stock Movements Execution ---
  public async executeStockMovement(input: {
    type: MovementType;
    sourceWarehouseId?: string;
    targetWarehouseId?: string;
    supplierId?: string;
    referenceDoc?: string;
    idempotencyKey?: string;
    notes?: string;
    createdByUserId: string;
    details: Array<{
      itemId: string;
      quantity: number;
      unitCost?: number;
      notes?: string;
    }>;
  }): Promise<StockMovement> {
    return this.runTransaction(async (db) => {
      // 1. Idempotency Check (Prevent double submit)
      if (input.idempotencyKey) {
        const existing = db.data.stockMovements.find(m => m.idempotencyKey === input.idempotencyKey);
        if (existing) {
          return existing; // Idempotent return
        }
      }

      if (!input.details || input.details.length === 0) {
        throw new Error('Transaksi harus menyertakan minimal 1 item.');
      }

      const creator = db.findUserById(input.createdByUserId);
      const sourceWh = input.sourceWarehouseId ? db.getWarehouseById(input.sourceWarehouseId) : undefined;
      const targetWh = input.targetWarehouseId ? db.getWarehouseById(input.targetWarehouseId) : undefined;
      const supplier = input.supplierId ? db.data.suppliers.find(s => s.id === input.supplierId) : undefined;

      const movementId = `mov-${Date.now()}`;
      const movementNumber = `MOV-${new Date().toISOString().slice(0, 7).replace('-', '')}-${Math.floor(100 + Math.random() * 900)}`;

      const movementDetails: StockMovementDetail[] = [];

      // 2. Validate and Process each item
      for (const row of input.details) {
        if (row.quantity <= 0) {
          throw new Error(`Kuantitas item harus lebih besar dari 0.`);
        }

        const item = db.data.items.find(i => i.id === row.itemId);
        if (!item) {
          throw new Error(`Barang dengan ID '${row.itemId}' tidak ditemukan.`);
        }

        const unitCost = row.unitCost !== undefined ? row.unitCost : item.unitCost;
        const subtotal = unitCost * row.quantity;

        // Domain Rule Validations based on Movement Type:
        if (input.type === 'IN') {
          // Goods Receipt
          if (!input.targetWarehouseId) {
            throw new Error('Gudang tujuan (targetWarehouseId) wajib ditentukan untuk barang masuk.');
          }
          const currentBal = db.getStockBalance(item.id, input.targetWarehouseId);
          const currentQty = currentBal ? currentBal.quantity : 0;
          db.setStockBalance(item.id, input.targetWarehouseId, currentQty + row.quantity);

          // Update item total currentStock
          item.currentStock += row.quantity;
          item.updatedAt = new Date().toISOString();
        } else if (input.type === 'OUT') {
          // Goods Issue / Stock Out
          if (!input.sourceWarehouseId) {
            throw new Error('Gudang asal (sourceWarehouseId) wajib ditentukan untuk barang keluar.');
          }
          const currentBal = db.getStockBalance(item.id, input.sourceWarehouseId);
          const availableQty = currentBal ? currentBal.quantity : 0;

          // PREVENT NEGATIVE STOCK
          if (availableQty < row.quantity) {
            throw new Error(
              `Stok tidak mencukupi untuk '${item.name}' di ${sourceWh?.name || 'Gudang'}. Tersedia: ${availableQty} ${item.unitSymbol || 'unit'}, diminta: ${row.quantity}.`
            );
          }

          db.setStockBalance(item.id, input.sourceWarehouseId, availableQty - row.quantity);
          item.currentStock = Math.max(0, item.currentStock - row.quantity);
          item.updatedAt = new Date().toISOString();
        } else if (input.type === 'TRANSFER') {
          // Stock Transfer between warehouses
          if (!input.sourceWarehouseId || !input.targetWarehouseId) {
            throw new Error('Gudang asal dan gudang tujuan harus ditentukan untuk mutasi transfer.');
          }
          if (input.sourceWarehouseId === input.targetWarehouseId) {
            throw new Error('Gudang asal dan gudang tujuan tidak boleh sama.');
          }

          const sourceBal = db.getStockBalance(item.id, input.sourceWarehouseId);
          const sourceQty = sourceBal ? sourceBal.quantity : 0;

          // PREVENT NEGATIVE STOCK
          if (sourceQty < row.quantity) {
            throw new Error(
              `Stok gudang asal tidak mencukupi untuk transfer '${item.name}'. Tersedia: ${sourceQty}, diminta: ${row.quantity}.`
            );
          }

          const targetBal = db.getStockBalance(item.id, input.targetWarehouseId);
          const targetQty = targetBal ? targetBal.quantity : 0;

          db.setStockBalance(item.id, input.sourceWarehouseId, sourceQty - row.quantity);
          db.setStockBalance(item.id, input.targetWarehouseId, targetQty + row.quantity);
          // Total item currentStock remains constant during transfer
          item.updatedAt = new Date().toISOString();
        } else if (input.type === 'ADJUSTMENT') {
          // Manual adjustment (positive or negative handled by quantity or type)
          if (!input.targetWarehouseId && !input.sourceWarehouseId) {
            throw new Error('Gudang harus ditentukan untuk penyesuaian stok.');
          }
          const whId = input.targetWarehouseId || input.sourceWarehouseId!;
          const currentBal = db.getStockBalance(item.id, whId);
          const currentQty = currentBal ? currentBal.quantity : 0;
          db.setStockBalance(item.id, whId, Math.max(0, currentQty + row.quantity));
          item.currentStock = Math.max(0, item.currentStock + row.quantity);
          item.updatedAt = new Date().toISOString();
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

      const newMovement: StockMovement = {
        id: movementId,
        movementNumber,
        type: input.type,
        status: 'COMPLETED',
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
        createdByName: creator?.name || 'User',
        createdAt: new Date().toISOString(),
        details: movementDetails
      };

      db.data.stockMovements.unshift(newMovement);

      // Audit Log
      db.logAudit({
        action: `STOCK_${input.type}`,
        entity: 'StockMovement',
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

  public getStockMovements(filters?: {
    type?: MovementType;
    warehouseId?: string;
    page?: number;
    limit?: number;
  }): { movements: StockMovement[]; total: number } {
    let list = this.data.stockMovements;
    if (filters?.type) {
      list = list.filter(m => m.type === filters.type);
    }
    if (filters?.warehouseId) {
      list = list.filter(m => m.sourceWarehouseId === filters.warehouseId || m.targetWarehouseId === filters.warehouseId);
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
  public getAssetUnits(filters?: {
    status?: string;
    condition?: string;
    warehouseId?: string;
    assignedToUserId?: string;
    search?: string;
  }): AssetUnit[] {
    let list = this.data.assetUnits;
    if (filters?.status) {
      list = list.filter(a => a.status === filters.status);
    }
    if (filters?.condition) {
      list = list.filter(a => a.condition === filters.condition);
    }
    if (filters?.warehouseId) {
      list = list.filter(a => a.warehouseId === filters.warehouseId);
    }
    if (filters?.assignedToUserId) {
      list = list.filter(a => a.assignedToUserId === filters.assignedToUserId);
    }
    if (filters?.search) {
      const q = filters.search.toLowerCase();
      list = list.filter(a => 
        a.assetTag.toLowerCase().includes(q) ||
        a.serialNumber.toLowerCase().includes(q) ||
        (a.itemName && a.itemName.toLowerCase().includes(q))
      );
    }
    return list;
  }

  public getAssetById(id: string): AssetUnit | undefined {
    return this.data.assetUnits.find(a => a.id === id || a.assetTag === id || a.serialNumber === id);
  }

  public createAssetUnit(input: Omit<AssetUnit, 'id' | 'createdAt' | 'updatedAt'>): AssetUnit {
    // Check assetTag and serialNumber uniqueness
    if (this.data.assetUnits.some(a => a.assetTag.toLowerCase() === input.assetTag.toLowerCase())) {
      throw new Error(`Asset Tag '${input.assetTag}' sudah digunakan.`);
    }
    if (this.data.assetUnits.some(a => a.serialNumber.toLowerCase() === input.serialNumber.toLowerCase())) {
      throw new Error(`Serial Number '${input.serialNumber}' sudah terdaftar.`);
    }

    const item = this.data.items.find(i => i.id === input.itemId);
    if (!item) {
      throw new Error(`Item ID '${input.itemId}' tidak ditemukan.`);
    }
    if (item.itemType !== 'SERIALIZED_ASSET') {
      throw new Error(`Item '${item.name}' bertipe CONSUMABLE dan tidak dapat didaftarkan sebagai serialized asset unit.`);
    }

    const wh = this.data.warehouses.find(w => w.id === input.warehouseId);

    const newAsset: AssetUnit = {
      ...input,
      id: `ast-${Date.now()}`,
      itemName: item.name,
      itemSku: item.sku,
      warehouseName: wh?.name,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.data.assetUnits.unshift(newAsset);

    // Update item currentStock counter
    item.currentStock += 1;
    item.updatedAt = new Date().toISOString();

    return newAsset;
  }

  public updateAssetStatus(assetId: string, updates: {
    status?: any;
    condition?: any;
    assignedToUserId?: string;
    department?: string;
    notes?: string;
    assignedByUserId?: string;
  }): AssetUnit {
    const asset = this.data.assetUnits.find(a => a.id === assetId);
    if (!asset) {
      throw new Error(`Unit aset '${assetId}' tidak ditemukan.`);
    }

    if (updates.assignedToUserId) {
      const user = this.findUserById(updates.assignedToUserId);
      asset.assignedToUserId = user?.id;
      asset.assignedToUserName = user?.name;
      asset.department = updates.department || user?.department;
      asset.status = 'ASSIGNED';
    } else if (updates.status === 'AVAILABLE') {
      asset.assignedToUserId = undefined;
      asset.assignedToUserName = undefined;
      asset.status = 'AVAILABLE';
    }

    if (updates.status) asset.status = updates.status;
    if (updates.condition) asset.condition = updates.condition;
    if (updates.notes) asset.notes = updates.notes;
    asset.updatedAt = new Date().toISOString();

    return asset;
  }

  // --- Audit Logs ---
  public getAuditLogs(limit = 100): AuditLog[] {
    return this.data.auditLogs.slice(0, limit);
  }

  // --- Item Requests ---
  public getItemRequests(): ItemRequest[] {
    return this.data.itemRequests;
  }

  public createItemRequest(input: Omit<ItemRequest, 'id' | 'requestNumber' | 'createdAt'>): ItemRequest {
    const id = `req-${Date.now()}`;
    const requestNumber = `REQ-${new Date().toISOString().slice(0, 7).replace('-', '')}-${Math.floor(100 + Math.random() * 900)}`;
    const user = this.findUserById(input.requestedByUserId);

    const newReq: ItemRequest = {
      ...input,
      id,
      requestNumber,
      requestedByName: user?.name,
      createdAt: new Date().toISOString(),
    };
    this.data.itemRequests.unshift(newReq);
    return newReq;
  }

  // --- Stock Opnames ---
  public getStockOpnames(): StockOpname[] {
    return this.data.stockOpnames;
  }

  public createStockOpname(input: Omit<StockOpname, 'id' | 'opnameNumber' | 'createdAt'>): StockOpname {
    const id = `opn-${Date.now()}`;
    const opnameNumber = `OPN-${new Date().toISOString().slice(0, 7).replace('-', '')}-${Math.floor(100 + Math.random() * 900)}`;
    const wh = this.getWarehouseById(input.warehouseId);

    const newOpn: StockOpname = {
      ...input,
      id,
      opnameNumber,
      warehouseName: wh?.name,
      createdAt: new Date().toISOString()
    };
    this.data.stockOpnames.unshift(newOpn);
    return newOpn;
  }
}

export const dbStore = new DatabaseStore();
