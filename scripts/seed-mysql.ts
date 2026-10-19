import { PrismaClient } from '@prisma/client';
import { getInitialSeedData } from '../server/db/seedData.ts';

const prisma = new PrismaClient();

async function main() {
  console.log('[SEED] Memulai proses seeding ke database MySQL Hostinger...');
  const seed = getInitialSeedData();

  // 1. Users
  console.log(`[SEED] Menyimpan ${seed.users.length} data pengguna...`);
  for (const u of seed.users) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: {
        name: u.name,
        role: u.role as any,
        department: u.department,
        passwordHash: u.passwordHash,
      },
      create: {
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role as any,
        department: u.department,
        passwordHash: u.passwordHash,
        isActive: true,
      },
    });
  }

  // 2. Categories
  console.log(`[SEED] Menyimpan ${seed.categories.length} kategori...`);
  for (const c of seed.categories) {
    await prisma.category.upsert({
      where: { code: c.code },
      update: { name: c.name, description: c.description },
      create: { id: c.id, code: c.code, name: c.name, description: c.description },
    });
  }

  // 3. Units
  console.log(`[SEED] Menyimpan ${seed.units.length} satuan unit...`);
  for (const unit of seed.units) {
    await prisma.unit.upsert({
      where: { symbol: unit.symbol },
      update: { name: unit.name, description: unit.description },
      create: { id: unit.id, name: unit.name, symbol: unit.symbol, description: unit.description },
    });
  }

  // 4. Suppliers
  console.log(`[SEED] Menyimpan ${seed.suppliers.length} supplier...`);
  for (const s of seed.suppliers) {
    await prisma.supplier.upsert({
      where: { code: s.code },
      update: {
        name: s.name,
        contactName: s.contactName,
        email: s.email,
        phone: s.phone,
        address: s.address,
        city: s.city,
        rating: s.rating,
      },
      create: {
        id: s.id,
        code: s.code,
        name: s.name,
        contactName: s.contactName,
        email: s.email,
        phone: s.phone,
        address: s.address,
        city: s.city,
        rating: s.rating,
        isActive: true,
      },
    });
  }

  // 5. Warehouses
  console.log(`[SEED] Menyimpan ${seed.warehouses.length} gudang logistik...`);
  for (const w of seed.warehouses) {
    await prisma.warehouse.upsert({
      where: { code: w.code },
      update: {
        name: w.name,
        branch: w.branch,
        address: w.address,
        capacityCbm: w.capacityCbm,
      },
      create: {
        id: w.id,
        code: w.code,
        name: w.name,
        branch: w.branch,
        address: w.address,
        capacityCbm: w.capacityCbm,
        isActive: true,
      },
    });
  }

  // 6. Items & Stock Balances
  console.log(`[SEED] Menyimpan ${seed.items.length} master barang & saldo awal...`);
  for (const item of seed.items) {
    await prisma.item.upsert({
      where: { sku: item.sku },
      update: {
        name: item.name,
        currentStock: item.currentStock,
        unitCost: item.unitCost,
        unitPrice: item.unitPrice,
        minStock: item.minStock,
        maxStock: item.maxStock,
        reorderPoint: item.reorderPoint,
        safetyStock: item.safetyStock,
      },
      create: {
        id: item.id,
        sku: item.sku,
        barcode: item.barcode,
        name: item.name,
        description: item.description,
        categoryId: item.categoryId,
        unitId: item.unitId,
        supplierId: item.supplierId,
        itemType: item.itemType as any,
        currentStock: item.currentStock,
        minStock: item.minStock,
        maxStock: item.maxStock,
        reorderPoint: item.reorderPoint,
        safetyStock: item.safetyStock,
        unitCost: item.unitCost,
        unitPrice: item.unitPrice,
        specifications: item.specifications || {},
        isActive: true,
      },
    });

    // Populate balances
    if (item.stockBalances && item.stockBalances.length > 0) {
      for (const sb of item.stockBalances) {
        await prisma.stockBalance.upsert({
          where: {
            itemId_warehouseId: {
              itemId: sb.itemId,
              warehouseId: sb.warehouseId,
            },
          },
          update: {
            quantity: sb.quantity,
            reservedQty: sb.reservedQty,
          },
          create: {
            id: sb.id,
            itemId: sb.itemId,
            warehouseId: sb.warehouseId,
            quantity: sb.quantity,
            reservedQty: sb.reservedQty,
          },
        });
      }
    }
  }

  // 7. Serialized Asset Units
  console.log(`[SEED] Menyimpan ${seed.assetUnits.length} unit aset bernomor seri...`);
  for (const a of seed.assetUnits) {
    await prisma.assetUnit.upsert({
      where: { serialNumber: a.serialNumber },
      update: {
        assetTag: a.assetTag,
        status: a.status as any,
        condition: a.condition as any,
        assignedToUserId: a.assignedToUserId,
        department: a.department,
      },
      create: {
        id: a.id,
        assetTag: a.assetTag,
        serialNumber: a.serialNumber,
        itemId: a.itemId,
        warehouseId: a.warehouseId,
        status: a.status as any,
        condition: a.condition as any,
        assignedToUserId: a.assignedToUserId,
        department: a.department,
        purchaseDate: a.purchaseDate ? new Date(a.purchaseDate) : null,
        purchaseCost: a.purchaseCost,
        warrantyExpiry: a.warrantyExpiry ? new Date(a.warrantyExpiry) : null,
        notes: a.notes,
      },
    });
  }

  console.log('=== [SEED SUCCESS] Database Hostinger MySQL berhasil diisi data awal enterprise! ===');
}

main()
  .catch((e) => {
    console.error('[SEED ERROR] Gagal melakukan seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
