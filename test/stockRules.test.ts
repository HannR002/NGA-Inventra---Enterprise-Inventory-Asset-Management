import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseStore } from '../server/db/store.ts';
import { hasPermission, ROLE_PERMISSIONS } from '../server/security/auth.ts';

test('RBAC: Super Admin has full system permissions', () => {
  assert.equal(hasPermission('SUPER_ADMIN', 'items:create'), true);
  assert.equal(hasPermission('SUPER_ADMIN', 'movements:in'), true);
  assert.equal(hasPermission('SUPER_ADMIN', 'settings:manage'), true);
});

test('RBAC: Inventory Staff cannot approve movements or manage users', () => {
  assert.equal(hasPermission('INVENTORY_STAFF', 'movements:in'), true);
  assert.equal(hasPermission('INVENTORY_STAFF', 'movements:out'), true);
  assert.equal(hasPermission('INVENTORY_STAFF', 'movements:approve'), false);
  assert.equal(hasPermission('INVENTORY_STAFF', 'users:manage'), false);
});

test('Stock Rules: Prevent negative stock on goods issue (OUT)', async () => {
  const db = new DatabaseStore();
  const wh = db.getWarehouses()[0];
  const item = db.createItem({
    sku: `TEST-SKU-${Date.now()}`,
    barcode: `8999${Date.now()}`,
    name: 'Unit Test Consumable Item',
    description: 'Testing negative stock prevention',
    categoryId: 'cat-pck',
    unitId: 'u-pcs',
    itemType: 'CONSUMABLE',
    currentStock: 10,
    minStock: 5,
    maxStock: 50,
    reorderPoint: 8,
    safetyStock: 2,
    unitCost: 10000,
    unitPrice: 15000,
    isActive: true
  });

  // Balance initialized to 10 in default warehouse
  assert.equal(item.currentStock, 10);

  // Attempting to withdraw 15 units should throw error
  await assert.rejects(
    async () => {
      await db.executeStockMovement({
        type: 'OUT',
        sourceWarehouseId: wh.id,
        createdByUserId: 'usr-admin-01',
        details: [{ itemId: item.id, quantity: 15 }]
      });
    },
    /Stok tidak mencukupi/
  );

  // Successful withdrawal of 4 units
  const movement = await db.executeStockMovement({
    type: 'OUT',
    sourceWarehouseId: wh.id,
    createdByUserId: 'usr-admin-01',
    details: [{ itemId: item.id, quantity: 4 }]
  });

  assert.equal(movement.type, 'OUT');
  const updatedItem = db.getItemById(item.id);
  assert.equal(updatedItem?.currentStock, 6);
});

test('Idempotency: Re-submitting the same idempotencyKey returns existing movement without duplicate deduction', async () => {
  const db = new DatabaseStore();
  const wh = db.getWarehouses()[0];
  const item = db.createItem({
    sku: `IDEMP-SKU-${Date.now()}`,
    barcode: `8998${Date.now()}`,
    name: 'Idempotency Test Item',
    description: 'Testing double-submit prevention',
    categoryId: 'cat-pck',
    unitId: 'u-pcs',
    itemType: 'CONSUMABLE',
    currentStock: 50,
    minStock: 10,
    maxStock: 100,
    reorderPoint: 20,
    safetyStock: 5,
    unitCost: 20000,
    unitPrice: 30000,
    isActive: true
  });

  const uniqueKey = `KEY-${Date.now()}`;

  // First submit
  const res1 = await db.executeStockMovement({
    type: 'OUT',
    sourceWarehouseId: wh.id,
    idempotencyKey: uniqueKey,
    createdByUserId: 'usr-admin-01',
    details: [{ itemId: item.id, quantity: 10 }]
  });

  assert.equal(res1.idempotencyKey, uniqueKey);
  const stockAfter1 = db.getItemById(item.id)?.currentStock;
  assert.equal(stockAfter1, 40);

  // Duplicate submit with same key (simulating network retry or double-click)
  const res2 = await db.executeStockMovement({
    type: 'OUT',
    sourceWarehouseId: wh.id,
    idempotencyKey: uniqueKey,
    createdByUserId: 'usr-admin-01',
    details: [{ itemId: item.id, quantity: 10 }]
  });

  // Must return original movement and stock must NOT be deducted again
  assert.equal(res2.id, res1.id);
  const stockAfter2 = db.getItemById(item.id)?.currentStock;
  assert.equal(stockAfter2, 40);
});

test('Domain Separation: Consumable items cannot be registered as unique serialized asset units', () => {
  const db = new DatabaseStore();
  const consumableItem = db.getItems().items.find(i => i.itemType === 'CONSUMABLE');
  assert.ok(consumableItem);

  assert.throws(
    () => {
      db.createAssetUnit({
        assetTag: `AST-TEST-${Date.now()}`,
        serialNumber: `SN-TEST-${Date.now()}`,
        itemId: consumableItem.id,
        warehouseId: db.getWarehouses()[0].id,
        status: 'AVAILABLE',
        condition: 'NEW',
        purchaseCost: 100000
      });
    },
    /bertipe CONSUMABLE dan tidak dapat didaftarkan sebagai serialized asset/
  );
});

test('Transfer Mutation: Total stock across warehouses remains conserved', async () => {
  const db = new DatabaseStore();
  const whs = db.getWarehouses();
  assert.ok(whs.length >= 2);
  const [wh1, wh2] = whs;

  const item = db.createItem({
    sku: `TRF-SKU-${Date.now()}`,
    barcode: `8997${Date.now()}`,
    name: 'Transfer Conservation Test Item',
    description: 'Testing total balance conservation',
    categoryId: 'cat-net',
    unitId: 'u-pcs',
    itemType: 'CONSUMABLE',
    currentStock: 30, // all in wh1
    minStock: 5,
    maxStock: 100,
    reorderPoint: 10,
    safetyStock: 2,
    unitCost: 50000,
    unitPrice: 75000,
    isActive: true
  });

  const totalBefore = item.currentStock;
  const wh1Before = db.getStockBalance(item.id, wh1.id)?.quantity || 0;
  const wh2Before = db.getStockBalance(item.id, wh2.id)?.quantity || 0;

  // Transfer 12 units from wh1 to wh2
  await db.executeStockMovement({
    type: 'TRANSFER',
    sourceWarehouseId: wh1.id,
    targetWarehouseId: wh2.id,
    createdByUserId: 'usr-admin-01',
    details: [{ itemId: item.id, quantity: 12 }]
  });

  const wh1After = db.getStockBalance(item.id, wh1.id)?.quantity || 0;
  const wh2After = db.getStockBalance(item.id, wh2.id)?.quantity || 0;
  const totalAfter = db.getItemById(item.id)?.currentStock || 0;

  assert.equal(wh1After, wh1Before - 12);
  assert.equal(wh2After, wh2Before + 12);
  assert.equal(totalAfter, totalBefore);
});
