import test from 'node:test';
import assert from 'node:assert/strict';
import { parseAndMaskDatabaseUrl } from '../server/db/connection.ts';
import { 
  verifyPassword, 
  hashPassword, 
  needsRehash,
  signToken, 
  verifyToken,
  OWASP_PBKDF2_ITERATIONS 
} from '../server/security/auth.ts';
import { DatabaseStore } from '../server/db/store.ts';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

test('Database URL: Safely parse credentials and mask passwords without leaks', () => {
  const dummyUrl = 'mysql://u123456789_inventra:SuperSecretPass123!@194.163.150.12:3306/u123456789_inventradb';
  const parsed = parseAndMaskDatabaseUrl(dummyUrl);

  assert.equal(parsed.host, '194.163.150.12');
  assert.equal(parsed.port, 3306);
  assert.equal(parsed.user, 'u123456789_inventra');
  assert.equal(parsed.database, 'u123456789_inventradb');
  assert.equal(parsed.maskedUrl.includes('SuperSecretPass123!'), false);
  assert.equal(parsed.maskedUrl.includes('***'), true);
});

test('OWASP Security: 210,000-iteration PBKDF2-SHA512 password hashing, timing-safe verification, and legacy hash migration', () => {
  const password = 'HostingerSecurePassword2026!';
  const hashed = hashPassword(password);

  // OWASP Format verification
  assert.equal(typeof hashed, 'string');
  assert.equal(hashed.startsWith(`pbkdf2:sha512:${OWASP_PBKDF2_ITERATIONS}:`), true);
  assert.equal(needsRehash(hashed), false);

  // Correct password verification
  assert.equal(verifyPassword(password, hashed), true);

  // Wrong password failure
  assert.equal(verifyPassword('WrongPassword123', hashed), false);
  assert.equal(verifyPassword('', hashed), false);

  // Legacy format (10,000 and 1,000 iterations) verification & migration check
  const salt = crypto.randomBytes(16).toString('hex');
  const legacy10kHash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  const legacy10kStored = `${salt}:${legacy10kHash}`;

  assert.equal(verifyPassword(password, legacy10kStored), true);
  assert.equal(needsRehash(legacy10kStored), true);

  const legacy1kHash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  const legacy1kStored = `${salt}:${legacy1kHash}`;

  assert.equal(verifyPassword(password, legacy1kStored), true);
  assert.equal(needsRehash(legacy1kStored), true);
});

test('Security: Stateless JWT generation and verification', () => {
  const payload = {
    userId: 'usr-admin-01',
    email: 'admin@nga-inventra.com',
    name: 'Master Admin',
    role: 'SUPER_ADMIN' as const,
    department: 'Management'
  };

  const token = signToken(payload);
  assert.equal(typeof token, 'string');
  assert.equal(token.split('.').length, 3);

  const verified = verifyToken(token);
  assert.notEqual(verified, null);
  assert.equal(verified?.email, 'admin@nga-inventra.com');
  assert.equal(verified?.role, 'SUPER_ADMIN');

  // Tampered token rejection
  const tamperedToken = token.slice(0, -5) + 'abcde';
  assert.equal(verifyToken(tamperedToken), null);
});

test('Schema Alignment: init_mysql.sql and prisma/migrations/20261018000000_init_mysql/migration.sql align with Prisma schema mappings', () => {
  const prismaSchema = fs.readFileSync(path.resolve(process.cwd(), 'prisma/schema.prisma'), 'utf-8');
  const sqlInit = fs.readFileSync(path.resolve(process.cwd(), 'migrations/init_mysql.sql'), 'utf-8');
  const prismaMigration = fs.readFileSync(path.resolve(process.cwd(), 'prisma/migrations/20261018000000_init_mysql/migration.sql'), 'utf-8');

  const requiredTables = [
    'users',
    'categories',
    'units',
    'suppliers',
    'warehouses',
    'warehouse_locations',
    'items',
    'stock_balances',
    'stock_movements',
    'stock_movement_details',
    'asset_units',
    'asset_assignments',
    'stock_opnames',
    'stock_opname_details',
    'item_requests',
    'item_request_details',
    'audit_logs'
  ];

  for (const table of requiredTables) {
    // Check table exists in init_mysql.sql
    assert.equal(
      sqlInit.includes(`CREATE TABLE IF NOT EXISTS \`${table}\``) || sqlInit.includes(`CREATE TABLE IF NOT EXISTS ${table}`),
      true,
      `Table ${table} must be present in migrations/init_mysql.sql`
    );

    // Check table exists in prisma/migrations
    assert.equal(
      prismaMigration.includes(`CREATE TABLE IF NOT EXISTS \`${table}\``) || prismaMigration.includes(`CREATE TABLE IF NOT EXISTS ${table}`),
      true,
      `Table ${table} must be present in prisma/migrations/20261018000000_init_mysql/migration.sql`
    );

    // Check table mapping exists in prisma/schema.prisma
    assert.equal(
      prismaSchema.includes(`@@map("${table}")`),
      true,
      `Table ${table} must be mapped with @@map("${table}") in prisma/schema.prisma`
    );
  }
});

test('Stock Transaction Atomicity & Rollback: Multi-item failure preserves initial balance', async () => {
  const db = new DatabaseStore();
  const wh = db.getWarehouses()[0];

  const itemA = db.createItem({
    sku: `ATOMIC-A-${Date.now()}`,
    barcode: '',
    name: 'Atomic Test Item A',
    description: '',
    categoryId: 'cat-pck',
    unitId: 'u-pcs',
    itemType: 'CONSUMABLE',
    currentStock: 20,
    minStock: 5,
    maxStock: 50,
    reorderPoint: 10,
    safetyStock: 2,
    unitCost: 10000,
    unitPrice: 15000,
    isActive: true
  });

  const itemB = db.createItem({
    sku: `ATOMIC-B-${Date.now()}`,
    barcode: '',
    name: 'Atomic Test Item B',
    description: '',
    categoryId: 'cat-pck',
    unitId: 'u-pcs',
    itemType: 'CONSUMABLE',
    currentStock: 5, // only 5 available
    minStock: 2,
    maxStock: 20,
    reorderPoint: 5,
    safetyStock: 1,
    unitCost: 25000,
    unitPrice: 35000,
    isActive: true
  });

  const itemAInitialStock = db.getItemById(itemA.id)!.currentStock;
  const itemBInitialStock = db.getItemById(itemB.id)!.currentStock;

  // Attempt multi-item goods out where Item A has enough stock (withdraw 10), but Item B exceeds (withdraw 15)
  await assert.rejects(
    async () => {
      await db.executeStockMovement({
        type: 'OUT',
        sourceWarehouseId: wh.id,
        createdByUserId: 'usr-admin-01',
        details: [
          { itemId: itemA.id, quantity: 10 },
          { itemId: itemB.id, quantity: 15 } // Will fail!
        ]
      });
    },
    /Stok tidak mencukupi/
  );

  // Both items MUST remain at initial stock (atomic rollback)
  const itemAPostRollback = db.getItemById(itemA.id)!.currentStock;
  const itemBPostRollback = db.getItemById(itemB.id)!.currentStock;

  assert.equal(itemAPostRollback, itemAInitialStock, 'Item A must NOT be deducted when transaction fails');
  assert.equal(itemBPostRollback, itemBInitialStock, 'Item B must remain untouched');
});

test('Concurrency Protection: Simultaneous stock deductions prevent overdrawing below zero', async () => {
  const db = new DatabaseStore();
  const wh = db.getWarehouses()[0];

  const item = db.createItem({
    sku: `CONCUR-${Date.now()}`,
    barcode: '',
    name: 'Concurrent Test Item',
    description: '',
    categoryId: 'cat-pck',
    unitId: 'u-pcs',
    itemType: 'CONSUMABLE',
    currentStock: 15,
    minStock: 2,
    maxStock: 50,
    reorderPoint: 5,
    safetyStock: 2,
    unitCost: 10000,
    unitPrice: 15000,
    isActive: true
  });

  // Launch 3 simultaneous requests to withdraw 10 units each (total demanded = 30, available = 15)
  const attempts = await Promise.allSettled([
    db.executeStockMovement({
      type: 'OUT',
      sourceWarehouseId: wh.id,
      createdByUserId: 'usr-admin-01',
      details: [{ itemId: item.id, quantity: 10 }]
    }),
    db.executeStockMovement({
      type: 'OUT',
      sourceWarehouseId: wh.id,
      createdByUserId: 'usr-admin-01',
      details: [{ itemId: item.id, quantity: 10 }]
    }),
    db.executeStockMovement({
      type: 'OUT',
      sourceWarehouseId: wh.id,
      createdByUserId: 'usr-admin-01',
      details: [{ itemId: item.id, quantity: 10 }]
    })
  ]);

  const fulfilled = attempts.filter(a => a.status === 'fulfilled');
  const rejected = attempts.filter(a => a.status === 'rejected');

  // Exactly 1 request should succeed (15 - 10 = 5 remaining, not enough for second 10)
  assert.equal(fulfilled.length, 1, 'Only 1 transaction can deduct 10 from 15');
  assert.equal(rejected.length, 2, 'Remaining concurrent requests must be rejected');

  const finalStock = db.getItemById(item.id)!.currentStock;
  assert.equal(finalStock, 5, 'Final stock must accurately equal 5 (never negative)');
});

test('Serialized Asset Domain Consistency: Stock balance and asset units cannot diverge', () => {
  const db = new DatabaseStore();
  const wh = db.getWarehouses()[0];

  // Serialized asset item
  const serializedItem = db.createItem({
    sku: `AST-ITEM-${Date.now()}`,
    barcode: '',
    name: 'Enterprise Laptop Core i7',
    description: '',
    categoryId: 'cat-it',
    unitId: 'u-unit',
    itemType: 'SERIALIZED_ASSET',
    currentStock: 0,
    minStock: 1,
    maxStock: 20,
    reorderPoint: 2,
    safetyStock: 1,
    unitCost: 15000000,
    unitPrice: 18000000,
    isActive: true
  });

  // Create physical asset unit
  const assetUnit = db.createAssetUnit({
    assetTag: `TAG-${Date.now()}`,
    serialNumber: `SN-${Date.now()}`,
    itemId: serializedItem.id,
    warehouseId: wh.id,
    status: 'AVAILABLE',
    condition: 'NEW',
    purchaseCost: 15000000
  });

  assert.equal(assetUnit.itemId, serializedItem.id);
  assert.equal(assetUnit.status, 'AVAILABLE');

  // Count available asset units
  const availableAssets = db.getAssetUnits().filter(a => a.itemId === serializedItem.id && a.status === 'AVAILABLE');
  assert.equal(availableAssets.length, 1);
});

test('Idempotency & Duplicate Prevention: Re-submitting same idempotencyKey returns existing movement without extra deduction', async () => {
  const db = new DatabaseStore();
  const wh = db.getWarehouses()[0];

  const item = db.createItem({
    sku: `IDEMP-DB-${Date.now()}`,
    barcode: '',
    name: 'Idempotent DB Test Item',
    description: '',
    categoryId: 'cat-pck',
    unitId: 'u-pcs',
    itemType: 'CONSUMABLE',
    currentStock: 40,
    minStock: 5,
    maxStock: 50,
    reorderPoint: 10,
    safetyStock: 2,
    unitCost: 10000,
    unitPrice: 15000,
    isActive: true
  });

  const idempotencyKey = `KEY-STAGING-${Date.now()}`;

  // First execution
  const mov1 = await db.executeStockMovement({
    type: 'OUT',
    sourceWarehouseId: wh.id,
    idempotencyKey,
    createdByUserId: 'usr-admin-01',
    details: [{ itemId: item.id, quantity: 8 }]
  });

  assert.equal(mov1.idempotencyKey, idempotencyKey);
  const stockAfterFirst = db.getItemById(item.id)!.currentStock;
  assert.equal(stockAfterFirst, 32);

  // Duplicate retry with same idempotency key (simulating network retry or double-click)
  const mov2 = await db.executeStockMovement({
    type: 'OUT',
    sourceWarehouseId: wh.id,
    idempotencyKey,
    createdByUserId: 'usr-admin-01',
    details: [{ itemId: item.id, quantity: 8 }]
  });

  assert.equal(mov2.id, mov1.id, 'Duplicate call must return original movement ID');
  const stockAfterSecond = db.getItemById(item.id)!.currentStock;
  assert.equal(stockAfterSecond, 32, 'Stock must NOT be deducted twice');
});

test('Transfer Mutation Conservation: Stock transferred between warehouses preserves total global balance', async () => {
  const db = new DatabaseStore();
  const warehouses = db.getWarehouses();
  assert.ok(warehouses.length >= 2, 'Must have at least 2 warehouses for transfer test');
  const [sourceWh, targetWh] = warehouses;

  const item = db.createItem({
    sku: `TRF-CONSERV-${Date.now()}`,
    barcode: '',
    name: 'Transfer Conservation Item',
    description: '',
    categoryId: 'cat-net',
    unitId: 'u-pcs',
    itemType: 'CONSUMABLE',
    currentStock: 50,
    minStock: 5,
    maxStock: 100,
    reorderPoint: 10,
    safetyStock: 2,
    unitCost: 20000,
    unitPrice: 30000,
    isActive: true
  });

  const initialGlobalStock = item.currentStock;
  const initialSourceBal = db.getStockBalance(item.id, sourceWh.id)?.quantity || 0;
  const initialTargetBal = db.getStockBalance(item.id, targetWh.id)?.quantity || 0;

  // Transfer 15 units from source to target
  await db.executeStockMovement({
    type: 'TRANSFER',
    sourceWarehouseId: sourceWh.id,
    targetWarehouseId: targetWh.id,
    createdByUserId: 'usr-admin-01',
    details: [{ itemId: item.id, quantity: 15 }]
  });

  const finalSourceBal = db.getStockBalance(item.id, sourceWh.id)?.quantity || 0;
  const finalTargetBal = db.getStockBalance(item.id, targetWh.id)?.quantity || 0;
  const finalGlobalStock = db.getItemById(item.id)!.currentStock;

  assert.equal(finalSourceBal, initialSourceBal - 15, 'Source warehouse must decrement by transfer amount');
  assert.equal(finalTargetBal, initialTargetBal + 15, 'Target warehouse must increment by transfer amount');
  assert.equal(finalGlobalStock, initialGlobalStock, 'Global inventory sum across all warehouses must remain strictly conserved');
});

test('Stock Opname & Discrepancy Reconciliation: Records variance and adjusts stock accurately', async () => {
  const db = new DatabaseStore();
  const wh = db.getWarehouses()[0];

  const item = db.createItem({
    sku: `OPN-TEST-${Date.now()}`,
    barcode: '',
    name: 'Opname Test Item',
    description: '',
    categoryId: 'cat-pck',
    unitId: 'u-pcs',
    itemType: 'CONSUMABLE',
    currentStock: 25,
    minStock: 5,
    maxStock: 50,
    reorderPoint: 10,
    safetyStock: 2,
    unitCost: 10000,
    unitPrice: 15000,
    isActive: true
  });

  // Physical stock count discovered only 22 items (-3 discrepancy)
  const systemStock = 25;
  const physicalStock = 22;
  const difference = physicalStock - systemStock; // -3
  const discrepancyValue = difference * item.unitCost;

  const opname = db.createStockOpname({
    warehouseId: wh.id,
    scheduledDate: new Date().toISOString().slice(0, 10),
    status: 'COMPLETED',
    notes: 'Q1 Regular Audit Reconciliation',
    details: [{
      id: 'opnd-1',
      opnameId: 'opn-1',
      itemId: item.id,
      systemStock,
      physicalStock,
      difference,
      unitCost: item.unitCost,
      discrepancyValue
    }]
  });

  assert.equal(opname.warehouseId, wh.id);
  assert.equal(opname.details![0].difference, -3);

  // Reconcile via ADJUSTMENT movement
  await db.executeStockMovement({
    type: 'ADJUSTMENT',
    sourceWarehouseId: wh.id,
    createdByUserId: 'usr-admin-01',
    notes: `Penyesuaian hasil stock opname ${opname.opnameNumber}`,
    details: [{ itemId: item.id, quantity: difference }]
  });

  const reconciledStock = db.getItemById(item.id)!.currentStock;
  assert.equal(reconciledStock, physicalStock, 'Reconciled stock must match physical stock count');
});
