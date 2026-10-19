export type RoleType = 
  | 'SUPER_ADMIN' 
  | 'WAREHOUSE_MANAGER' 
  | 'INVENTORY_STAFF' 
  | 'ASSET_CUSTODIAN' 
  | 'AUDITOR';

export type ItemType = 'CONSUMABLE' | 'SERIALIZED_ASSET';

export type MovementType = 'IN' | 'OUT' | 'TRANSFER' | 'RETURN' | 'ADJUSTMENT';

export type MovementStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'COMPLETED' | 'REJECTED' | 'CANCELLED';

export type AssetStatus = 'AVAILABLE' | 'ASSIGNED' | 'IN_MAINTENANCE' | 'DISPOSED' | 'LOST';

export type AssetCondition = 'NEW' | 'EXCELLENT' | 'GOOD' | 'FAIR' | 'DAMAGED';

export type RequestUrgency = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

export type RequestStatus = 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'FULFILLED' | 'CANCELLED';

export type OpnameStatus = 'DRAFT' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export interface User {
  id: string;
  email: string;
  name: string;
  role: RoleType;
  department: string;
  avatarUrl?: string;
  isActive: boolean;
  permissions?: string[];
}

export interface Category {
  id: string;
  code: string;
  name: string;
  description: string;
}

export interface Unit {
  id: string;
  name: string;
  symbol: string;
}

export interface Supplier {
  id: string;
  code: string;
  name: string;
  contactName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  rating: number;
}

export interface Warehouse {
  id: string;
  code: string;
  name: string;
  branch: string;
  address: string;
  capacityCbm: number;
  managerId?: string;
  managerName?: string;
  isActive: boolean;
}

export interface StockBalance {
  id: string;
  itemId: string;
  warehouseId: string;
  warehouseCode?: string;
  warehouseName?: string;
  quantity: number;
  reservedQty: number;
  updatedAt: string;
}

export interface Item {
  id: string;
  sku: string;
  barcode: string;
  name: string;
  description: string;
  categoryId: string;
  categoryName?: string;
  unitId: string;
  unitSymbol?: string;
  supplierId?: string;
  supplierName?: string;
  itemType: ItemType;
  currentStock: number;
  minStock: number;
  maxStock: number;
  reorderPoint: number;
  safetyStock: number;
  unitCost: number;
  unitPrice: number;
  specifications?: Record<string, string>;
  imageUrl?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  stockBalances?: StockBalance[];
}

export interface StockMovementDetail {
  id: string;
  movementId: string;
  itemId: string;
  itemSku?: string;
  itemName?: string;
  quantity: number;
  unitCost: number;
  subtotal: number;
  notes?: string;
}

export interface StockMovement {
  id: string;
  movementNumber: string;
  type: MovementType;
  status: MovementStatus;
  sourceWarehouseId?: string;
  sourceWarehouseName?: string;
  targetWarehouseId?: string;
  targetWarehouseName?: string;
  supplierId?: string;
  supplierName?: string;
  referenceDoc?: string;
  idempotencyKey?: string;
  notes?: string;
  createdByUserId: string;
  createdByName?: string;
  approvedByUserId?: string;
  approvedByName?: string;
  createdAt: string;
  details: StockMovementDetail[];
}

export interface AssetUnit {
  id: string;
  assetTag: string;
  serialNumber: string;
  itemId: string;
  itemName?: string;
  itemSku?: string;
  warehouseId: string;
  warehouseName?: string;
  locationId?: string;
  locationCode?: string;
  status: AssetStatus;
  condition: AssetCondition;
  assignedToUserId?: string;
  assignedToUserName?: string;
  department?: string;
  purchaseDate?: string;
  purchaseCost: number;
  warrantyExpiry?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StockOpnameDetail {
  id: string;
  opnameId: string;
  itemId: string;
  itemSku?: string;
  itemName?: string;
  systemStock: number;
  physicalStock: number;
  difference: number;
  unitCost: number;
  discrepancyValue: number;
  notes?: string;
}

export interface StockOpname {
  id: string;
  opnameNumber: string;
  warehouseId: string;
  warehouseName?: string;
  scheduledDate: string;
  status: OpnameStatus;
  notes?: string;
  createdAt: string;
  details: StockOpnameDetail[];
}

export interface ItemRequestDetail {
  id: string;
  requestId: string;
  itemId: string;
  itemSku?: string;
  itemName?: string;
  requestedQty: number;
  approvedQty?: number;
}

export interface ItemRequest {
  id: string;
  requestNumber: string;
  department: string;
  urgency: RequestUrgency;
  status: RequestStatus;
  reason: string;
  requestedByUserId: string;
  requestedByName?: string;
  approvedByUserId?: string;
  approvedByName?: string;
  approvedAt?: string;
  rejectionReason?: string;
  createdAt: string;
  details: ItemRequestDetail[];
}

export interface AuditLog {
  id: string;
  action: string;
  entity: string;
  entityId?: string;
  userId?: string;
  userName?: string;
  ipAddress?: string;
  detailsJson?: any;
  createdAt: string;
}

export interface DashboardMetrics {
  summary: {
    totalItems: number;
    totalStockValuation: number;
    lowStockCount: number;
    outOfStockCount: number;
    totalWarehouses: number;
    activeAssetUnits: number;
    inMaintenanceAssets: number;
  };
  warehouseBreakdown: Array<{
    id: string;
    code: string;
    name: string;
    branch: string;
    itemCount: number;
    totalQty: number;
    capacityCbm: number;
  }>;
  recentMovements: StockMovement[];
  movementTrends: Array<{
    month: string;
    in: number;
    out: number;
    transfer: number;
  }>;
  lowStockItems: Item[];
}
