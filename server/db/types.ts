// NGA Inventra - Core Domain Types and Database Interfaces

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
  passwordHash: string;
  name: string;
  role: RoleType;
  department: string;
  avatarUrl?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  code: string;
  name: string;
  description: string;
  createdAt: string;
}

export interface Unit {
  id: string;
  name: string;
  symbol: string;
  description?: string;
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
  isActive: boolean;
  createdAt: string;
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
  createdAt: string;
}

export interface WarehouseLocation {
  id: string;
  warehouseId: string;
  code: string;
  aisle: string;
  rack: string;
  shelf: string;
  bin?: string;
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
  
  // Separation of consumable quantity stock vs unique serialized assets
  itemType: ItemType;

  // Thresholds & Quantities
  currentStock: number;
  minStock: number;
  maxStock: number;
  reorderPoint: number;
  safetyStock: number;

  // Pricing & Valuation
  unitCost: number;
  unitPrice: number;

  specifications?: Record<string, string>;
  imageUrl?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;

  // Joined aggregates for response
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

export interface StockMovementDetailInput {
  itemId: string;
  quantity: number;
  unitCost?: number;
  notes?: string;
}

export interface StockMovementInput {
  type: MovementType;
  sourceWarehouseId?: string;
  targetWarehouseId?: string;
  supplierId?: string;
  referenceDoc?: string;
  idempotencyKey?: string;
  notes?: string;
  createdByUserId: string;
  details: StockMovementDetailInput[];
}

export interface AssetUnit {
  id: string;
  assetTag: string; // AST-2026-0001
  serialNumber: string; // SN-DELL-9821
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

export interface AssetAssignment {
  id: string;
  assetUnitId: string;
  assignedToUserId: string;
  assignedToUserName?: string;
  assignedByUserId: string;
  assignedByUserName?: string;
  department: string;
  assignedAt: string;
  returnedAt?: string;
  conditionAtAssignment: AssetCondition;
  conditionAtReturn?: AssetCondition;
  notes?: string;
}

export interface StockOpnameDetail {
  id: string;
  opnameId: string;
  itemId: string;
  itemSku?: string;
  itemName?: string;
  systemStock: number;
  physicalStock: number;
  difference: number; // physicalStock - systemStock
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
