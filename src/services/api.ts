import { 
  Item, 
  Warehouse, 
  Category, 
  Supplier, 
  Unit, 
  StockMovement, 
  AssetUnit, 
  StockOpname, 
  ItemRequest, 
  AuditLog, 
  User, 
  DashboardMetrics,
  RoleType
} from '../types';

const API_BASE = '/api';

class ApiService {
  private token: string | null = null;
  private currentRole: RoleType = 'SUPER_ADMIN';

  constructor() {
    this.token = localStorage.getItem('inventra_token');
    const savedRole = localStorage.getItem('inventra_role') as RoleType;
    if (savedRole) this.currentRole = savedRole;
  }

  public setToken(token: string | null, role?: RoleType) {
    this.token = token;
    if (token) {
      localStorage.setItem('inventra_token', token);
    } else {
      localStorage.removeItem('inventra_token');
    }
    if (role) {
      this.currentRole = role;
      localStorage.setItem('inventra_role', role);
    }
  }

  public getRole(): RoleType {
    return this.currentRole;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const res = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    if (!res.ok) {
      let errorMsg = `HTTP Error ${res.status}`;
      try {
        const errorData = await res.json();
        if (errorData.error) errorMsg = errorData.error;
      } catch {
        // use default errorMsg
      }
      throw new Error(errorMsg);
    }

    return res.json();
  }

  // Auth
  public async login(email: string, password: string): Promise<{ token: string; user: User }> {
    const res = await this.request<{ token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    this.setToken(res.token, res.user.role);
    return res;
  }

  public async getMe(): Promise<{ user: User }> {
    return this.request<{ user: User }>('/auth/me');
  }

  public async switchRole(role: RoleType): Promise<{ token: string; user: User }> {
    const res = await this.request<{ token: string; user: User }>('/auth/switch-role', {
      method: 'POST',
      body: JSON.stringify({ role }),
    });
    this.setToken(res.token, res.user.role);
    return res;
  }

  // Dashboard
  public async getDashboard(): Promise<DashboardMetrics> {
    return this.request<DashboardMetrics>('/dashboard');
  }

  // Items
  public async getItems(params?: {
    search?: string;
    categoryId?: string;
    itemType?: string;
    stockStatus?: string;
    page?: number;
    limit?: number;
  }): Promise<{ items: Item[]; total: number; page: number; limit: number }> {
    const query = new URLSearchParams();
    if (params?.search) query.append('search', params.search);
    if (params?.categoryId) query.append('categoryId', params.categoryId);
    if (params?.itemType) query.append('itemType', params.itemType);
    if (params?.stockStatus) query.append('stockStatus', params.stockStatus);
    if (params?.page) query.append('page', params.page.toString());
    if (params?.limit) query.append('limit', params.limit.toString());

    return this.request(`/items?${query.toString()}`);
  }

  public async getItem(id: string): Promise<{ item: Item; assetUnits: AssetUnit[] }> {
    return this.request(`/items/${id}`);
  }

  public async createItem(data: Partial<Item> & { initialStock?: number }): Promise<{ item: Item }> {
    return this.request('/items', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  public async updateItem(id: string, data: Partial<Item>): Promise<{ item: Item }> {
    return this.request(`/items/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // Warehouses, Categories, Suppliers, Units
  public async getWarehouses(): Promise<{ warehouses: Warehouse[] }> {
    return this.request('/warehouses');
  }

  public async createWarehouse(data: Partial<Warehouse>): Promise<{ warehouse: Warehouse }> {
    return this.request('/warehouses', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  public async getCategories(): Promise<{ categories: Category[] }> {
    return this.request('/categories');
  }

  public async getSuppliers(): Promise<{ suppliers: Supplier[] }> {
    return this.request('/suppliers');
  }

  public async getUnits(): Promise<{ units: Unit[] }> {
    return this.request('/units');
  }

  // Movements (Goods in, Stock out, Transfer)
  public async getMovements(params?: { type?: string; warehouseId?: string }): Promise<{ movements: StockMovement[]; total: number }> {
    const query = new URLSearchParams();
    if (params?.type) query.append('type', params.type);
    if (params?.warehouseId) query.append('warehouseId', params.warehouseId);
    return this.request(`/movements?${query.toString()}`);
  }

  public async createMovement(data: {
    type: 'IN' | 'OUT' | 'TRANSFER' | 'RETURN' | 'ADJUSTMENT';
    sourceWarehouseId?: string;
    targetWarehouseId?: string;
    supplierId?: string;
    referenceDoc?: string;
    idempotencyKey?: string;
    notes?: string;
    details: Array<{ itemId: string; quantity: number; unitCost?: number; notes?: string }>;
  }): Promise<{ movement: StockMovement }> {
    return this.request('/movements', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Serialized Assets
  public async getAssets(params?: {
    status?: string;
    condition?: string;
    warehouseId?: string;
    assignedToUserId?: string;
    search?: string;
  }): Promise<{ assets: AssetUnit[]; total: number }> {
    const query = new URLSearchParams();
    if (params?.status) query.append('status', params.status);
    if (params?.condition) query.append('condition', params.condition);
    if (params?.warehouseId) query.append('warehouseId', params.warehouseId);
    if (params?.assignedToUserId) query.append('assignedToUserId', params.assignedToUserId);
    if (params?.search) query.append('search', params.search);
    return this.request(`/assets?${query.toString()}`);
  }

  public async getAsset(id: string): Promise<{ asset: AssetUnit }> {
    return this.request(`/assets/${id}`);
  }

  public async createAsset(data: Partial<AssetUnit>): Promise<{ asset: AssetUnit }> {
    return this.request('/assets', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  public async updateAssetStatus(id: string, updates: {
    status?: string;
    condition?: string;
    assignedToUserId?: string;
    department?: string;
    notes?: string;
  }): Promise<{ asset: AssetUnit }> {
    return this.request(`/assets/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  // Stock Opname
  public async getOpnames(): Promise<{ opnames: StockOpname[] }> {
    return this.request('/opnames');
  }

  public async createOpname(data: {
    warehouseId: string;
    scheduledDate: string;
    notes?: string;
    details: Array<{
      itemId: string;
      itemSku: string;
      itemName: string;
      systemStock: number;
      physicalStock: number;
      unitCost: number;
      notes?: string;
    }>;
  }): Promise<{ opname: StockOpname }> {
    return this.request('/opnames', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Item Requests
  public async getRequests(): Promise<{ requests: ItemRequest[] }> {
    return this.request('/requests');
  }

  public async createRequest(data: {
    department: string;
    urgency: string;
    reason: string;
    details: Array<{ itemId: string; itemSku: string; itemName: string; requestedQty: number }>;
  }): Promise<{ request: ItemRequest }> {
    return this.request('/requests', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Users & Roles
  public async getUsers(): Promise<{ users: User[]; rolePermissions: Record<string, string[]> }> {
    return this.request('/users');
  }

  // Audit Logs
  public async getAuditLogs(limit = 100): Promise<{ auditLogs: AuditLog[] }> {
    return this.request(`/audit?limit=${limit}`);
  }

  // System status & reset
  public async getHealth(): Promise<any> {
    return this.request('/health');
  }

  public async getSystemStatus(): Promise<any> {
    return this.request('/system/status');
  }

  public async resetSeed(): Promise<{ message: string }> {
    return this.request('/system/reset-seed', { method: 'POST' });
  }
}

export const api = new ApiService();
