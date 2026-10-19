import { getPrismaClient, testDatabaseConnectivity } from './connection.ts';
import { PrismaMySQLRepository } from './mysqlRepository.ts';
import { dbStore, DatabaseStore } from './store.ts';
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

export interface IAppRepository {
  findUserByEmail(email: string): Promise<User | undefined | null> | User | undefined | null;
  findUserById(id: string): Promise<User | undefined | null> | User | undefined | null;
  updateUserPassword(id: string, newPasswordHash: string): Promise<void> | void;
  getUsers(): Promise<User[]> | User[];
  getCategories(): Promise<Category[]> | Category[];
  getUnits(): Promise<Unit[]> | Unit[];
  getSuppliers(): Promise<Supplier[]> | Supplier[];
  getWarehouses(): Promise<Warehouse[]> | Warehouse[];
  createWarehouse(input: Omit<Warehouse, 'id' | 'createdAt'>): Promise<Warehouse> | Warehouse;
  getItems(options?: any): Promise<{ items: Item[]; total: number; page?: number; limit?: number; totalPages?: number }> | { items: Item[]; total: number; page?: number; limit?: number; totalPages?: number };
  getItemById(id: string): Promise<Item | undefined | null> | Item | undefined | null;
  createItem(input: Omit<Item, 'id' | 'createdAt' | 'updatedAt'>): Promise<Item> | Item;
  updateItem(id: string, updates: Partial<Item>): Promise<Item> | Item;
  executeStockMovement(input: StockMovementInput): Promise<StockMovement>;
  getStockMovements(options?: any): Promise<{ movements: StockMovement[]; total: number; page?: number; limit?: number; totalPages?: number }> | { movements: StockMovement[]; total: number; page?: number; limit?: number; totalPages?: number };
  getAssetUnits(filter?: any): Promise<AssetUnit[]> | AssetUnit[];
  getAssetById(id: string): Promise<AssetUnit | undefined | null> | AssetUnit | undefined | null;
  createAssetUnit(input: Omit<AssetUnit, 'id' | 'createdAt' | 'updatedAt'>): Promise<AssetUnit> | AssetUnit;
  updateAssetStatus(id: string, updates: any): Promise<AssetUnit> | AssetUnit;
  getStockOpnames(): Promise<StockOpname[]> | StockOpname[];
  createStockOpname(input: Omit<StockOpname, 'id' | 'opnameNumber' | 'createdAt'>): Promise<StockOpname> | StockOpname;
  getItemRequests(): Promise<ItemRequest[]> | ItemRequest[];
  createItemRequest(input: Omit<ItemRequest, 'id' | 'requestNumber' | 'createdAt'>): Promise<ItemRequest> | ItemRequest;
  getAuditLogs(limit?: number): Promise<AuditLog[]> | AuditLog[];
  logAudit(entry: {
    action: string;
    entity: string;
    entityId?: string;
    userId?: string;
    userName?: string;
    ipAddress?: string;
    detailsJson?: any;
  }): Promise<AuditLog> | AuditLog;
}

class RepositoryManager {
  private activeRepo: IAppRepository | null = null;
  private activeEngine: 'PRISMA_MYSQL' | 'STANDALONE_STORE' = 'STANDALONE_STORE';
  private initialized = false;

  public async getRepository(): Promise<IAppRepository> {
    if (!this.initialized) {
      await this.init();
    }
    return this.activeRepo!;
  }

  public getActiveEngine(): 'PRISMA_MYSQL' | 'STANDALONE_STORE' {
    return this.activeEngine;
  }

  public async init(): Promise<void> {
    const isProduction = process.env.NODE_ENV === 'production';
    const hasDbUrl = Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL.trim());

    if (hasDbUrl) {
      const prisma = getPrismaClient();
      if (prisma) {
        try {
          const health = await testDatabaseConnectivity();
          if (health.status === 'CONNECTED') {
            console.log(`[DB] Berhasil terhubung ke MySQL Hostinger (${health.host}) versi ${health.databaseVersion}`);
            this.activeRepo = new PrismaMySQLRepository(prisma);
            this.activeEngine = 'PRISMA_MYSQL';
            this.initialized = true;
            return;
          } else {
            console.warn(`[DB WARNING] DATABASE_URL terpasang namun tes koneksi gagal: ${health.error}`);
            if (isProduction) {
              throw new Error(`Production database failure: Cannot connect to MySQL (${health.error}). Running without database in production is strictly forbidden.`);
            }
          }
        } catch (err: any) {
          console.error('[DB ERROR] Error connecting to Prisma MySQL:', err.message);
          if (isProduction) {
            throw err;
          }
        }
      }
    } else {
      if (isProduction) {
        throw new Error('Production environment failure: DATABASE_URL is required in production.');
      }
    }

    // Development / Local standalone fallback
    console.log('[DB] Menggunakan Standalone Persistent Store (Development / Isolated Sandbox Mode)');
    this.activeRepo = dbStore;
    this.activeEngine = 'STANDALONE_STORE';
    this.initialized = true;
  }
}

export const repoManager = new RepositoryManager();
