-- NGA Inventra - Enterprise Inventory & Asset Management
-- Database Migration Script for MySQL 8.0+
-- File: migrations/init_mysql.sql

CREATE DATABASE IF NOT EXISTS `inventra_db` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `inventra_db`;

SET FOREIGN_KEY_CHECKS = 0;

-- 1. Users Table
CREATE TABLE IF NOT EXISTS `users` (
  `id` VARCHAR(36) NOT NULL,
  `email` VARCHAR(191) NOT NULL,
  `passwordHash` VARCHAR(255) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `role` ENUM('SUPER_ADMIN', 'WAREHOUSE_MANAGER', 'INVENTORY_STAFF', 'ASSET_CUSTODIAN', 'AUDITOR') NOT NULL DEFAULT 'INVENTORY_STAFF',
  `department` VARCHAR(100) NULL,
  `avatarUrl` VARCHAR(255) NULL,
  `isActive` TINYINT(1) NOT NULL DEFAULT 1,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `users_email_unique` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Categories Table
CREATE TABLE IF NOT EXISTS `categories` (
  `id` VARCHAR(36) NOT NULL,
  `code` VARCHAR(50) NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `description` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `categories_code_unique` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Units of Measure
CREATE TABLE IF NOT EXISTS `units` (
  `id` VARCHAR(36) NOT NULL,
  `name` VARCHAR(50) NOT NULL,
  `symbol` VARCHAR(20) NOT NULL,
  `description` VARCHAR(255) NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `units_symbol_unique` (`symbol`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Suppliers Table
CREATE TABLE IF NOT EXISTS `suppliers` (
  `id` VARCHAR(36) NOT NULL,
  `code` VARCHAR(50) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `contactName` VARCHAR(100) NULL,
  `email` VARCHAR(191) NULL,
  `phone` VARCHAR(50) NULL,
  `address` TEXT NULL,
  `city` VARCHAR(100) NULL,
  `rating` DECIMAL(3, 2) NOT NULL DEFAULT 5.00,
  `isActive` TINYINT(1) NOT NULL DEFAULT 1,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `suppliers_code_unique` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Warehouses Table
CREATE TABLE IF NOT EXISTS `warehouses` (
  `id` VARCHAR(36) NOT NULL,
  `code` VARCHAR(50) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `branch` VARCHAR(100) NOT NULL,
  `address` TEXT NOT NULL,
  `capacityCbm` DECIMAL(10, 2) NOT NULL DEFAULT 1000.00,
  `managerId` VARCHAR(36) NULL,
  `isActive` TINYINT(1) NOT NULL DEFAULT 1,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `warehouses_code_unique` (`code`),
  CONSTRAINT `fk_warehouse_manager` FOREIGN KEY (`managerId`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Warehouse Locations Table
CREATE TABLE IF NOT EXISTS `warehouse_locations` (
  `id` VARCHAR(36) NOT NULL,
  `warehouseId` VARCHAR(36) NOT NULL,
  `code` VARCHAR(50) NOT NULL,
  `aisle` VARCHAR(20) NOT NULL,
  `rack` VARCHAR(20) NOT NULL,
  `shelf` VARCHAR(20) NOT NULL,
  `bin` VARCHAR(20) NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `loc_wh_code_unique` (`warehouseId`, `code`),
  CONSTRAINT `fk_location_warehouse` FOREIGN KEY (`warehouseId`) REFERENCES `warehouses` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Items Table (Explicit Separation of Consumable Quantity Stock vs Serialized Asset)
CREATE TABLE IF NOT EXISTS `items` (
  `id` VARCHAR(36) NOT NULL,
  `sku` VARCHAR(100) NOT NULL,
  `barcode` VARCHAR(100) NULL,
  `name` VARCHAR(191) NOT NULL,
  `description` TEXT NULL,
  `categoryId` VARCHAR(36) NOT NULL,
  `unitId` VARCHAR(36) NOT NULL,
  `supplierId` VARCHAR(36) NULL,
  `itemType` ENUM('CONSUMABLE', 'SERIALIZED_ASSET') NOT NULL DEFAULT 'CONSUMABLE',
  `currentStock` INT NOT NULL DEFAULT 0,
  `minStock` INT NOT NULL DEFAULT 10,
  `maxStock` INT NOT NULL DEFAULT 500,
  `reorderPoint` INT NOT NULL DEFAULT 20,
  `safetyStock` INT NOT NULL DEFAULT 5,
  `unitCost` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `unitPrice` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `specifications` JSON NULL,
  `imageUrl` VARCHAR(255) NULL,
  `isActive` TINYINT(1) NOT NULL DEFAULT 1,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `items_sku_unique` (`sku`),
  UNIQUE KEY `items_barcode_unique` (`barcode`),
  KEY `items_category_idx` (`categoryId`),
  KEY `items_type_idx` (`itemType`),
  CONSTRAINT `fk_item_category` FOREIGN KEY (`categoryId`) REFERENCES `categories` (`id`),
  CONSTRAINT `fk_item_unit` FOREIGN KEY (`unitId`) REFERENCES `units` (`id`),
  CONSTRAINT `fk_item_supplier` FOREIGN KEY (`supplierId`) REFERENCES `suppliers` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. Stock Balances Table (Stock per Warehouse with Reservation)
CREATE TABLE IF NOT EXISTS `stock_balances` (
  `id` VARCHAR(36) NOT NULL,
  `itemId` VARCHAR(36) NOT NULL,
  `warehouseId` VARCHAR(36) NOT NULL,
  `quantity` INT NOT NULL DEFAULT 0,
  `reservedQty` INT NOT NULL DEFAULT 0,
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `stock_bal_item_wh_unique` (`itemId`, `warehouseId`),
  CONSTRAINT `chk_positive_qty` CHECK (`quantity` >= 0),
  CONSTRAINT `fk_sb_item` FOREIGN KEY (`itemId`) REFERENCES `items` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_sb_warehouse` FOREIGN KEY (`warehouseId`) REFERENCES `warehouses` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. Stock Movements Table (Goods In, Out, Transfer, Return, Adjustment)
CREATE TABLE IF NOT EXISTS `stock_movements` (
  `id` VARCHAR(36) NOT NULL,
  `movementNumber` VARCHAR(100) NOT NULL,
  `type` ENUM('IN', 'OUT', 'TRANSFER', 'RETURN', 'ADJUSTMENT') NOT NULL,
  `status` ENUM('DRAFT', 'SUBMITTED', 'APPROVED', 'COMPLETED', 'REJECTED', 'CANCELLED') NOT NULL DEFAULT 'COMPLETED',
  `sourceWarehouseId` VARCHAR(36) NULL,
  `targetWarehouseId` VARCHAR(36) NULL,
  `supplierId` VARCHAR(36) NULL,
  `referenceDoc` VARCHAR(100) NULL,
  `idempotencyKey` VARCHAR(100) NULL,
  `notes` TEXT NULL,
  `createdByUserId` VARCHAR(36) NOT NULL,
  `approvedByUserId` VARCHAR(36) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `movements_number_unique` (`movementNumber`),
  UNIQUE KEY `movements_idempotency_unique` (`idempotencyKey`),
  KEY `movements_type_idx` (`type`),
  KEY `movements_created_idx` (`createdAt`),
  CONSTRAINT `fk_sm_source_wh` FOREIGN KEY (`sourceWarehouseId`) REFERENCES `warehouses` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_sm_target_wh` FOREIGN KEY (`targetWarehouseId`) REFERENCES `warehouses` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_sm_supplier` FOREIGN KEY (`supplierId`) REFERENCES `suppliers` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_sm_creator` FOREIGN KEY (`createdByUserId`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_sm_approver` FOREIGN KEY (`approvedByUserId`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 10. Stock Movement Details Table
CREATE TABLE IF NOT EXISTS `stock_movement_details` (
  `id` VARCHAR(36) NOT NULL,
  `movementId` VARCHAR(36) NOT NULL,
  `itemId` VARCHAR(36) NOT NULL,
  `quantity` INT NOT NULL,
  `unitCost` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `subtotal` DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
  `notes` VARCHAR(255) NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_smd_movement` FOREIGN KEY (`movementId`) REFERENCES `stock_movements` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_smd_item` FOREIGN KEY (`itemId`) REFERENCES `items` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 11. Asset Units Table (Serialized Items with Serial Number & Custodian)
CREATE TABLE IF NOT EXISTS `asset_units` (
  `id` VARCHAR(36) NOT NULL,
  `assetTag` VARCHAR(100) NOT NULL,
  `serialNumber` VARCHAR(100) NOT NULL,
  `itemId` VARCHAR(36) NOT NULL,
  `warehouseId` VARCHAR(36) NOT NULL,
  `locationId` VARCHAR(36) NULL,
  `status` ENUM('AVAILABLE', 'ASSIGNED', 'IN_MAINTENANCE', 'DISPOSED', 'LOST') NOT NULL DEFAULT 'AVAILABLE',
  `condition` ENUM('NEW', 'EXCELLENT', 'GOOD', 'FAIR', 'DAMAGED') NOT NULL DEFAULT 'GOOD',
  `assignedToUserId` VARCHAR(36) NULL,
  `department` VARCHAR(100) NULL,
  `purchaseDate` DATE NULL,
  `purchaseCost` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `warrantyExpiry` DATE NULL,
  `notes` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `asset_tag_unique` (`assetTag`),
  UNIQUE KEY `asset_serial_unique` (`serialNumber`),
  KEY `asset_status_idx` (`status`),
  CONSTRAINT `fk_asset_item` FOREIGN KEY (`itemId`) REFERENCES `items` (`id`),
  CONSTRAINT `fk_asset_wh` FOREIGN KEY (`warehouseId`) REFERENCES `warehouses` (`id`),
  CONSTRAINT `fk_asset_loc` FOREIGN KEY (`locationId`) REFERENCES `warehouse_locations` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_asset_custodian` FOREIGN KEY (`assignedToUserId`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 12. Asset Assignment History Table
CREATE TABLE IF NOT EXISTS `asset_assignments` (
  `id` VARCHAR(36) NOT NULL,
  `assetUnitId` VARCHAR(36) NOT NULL,
  `assignedToUserId` VARCHAR(36) NOT NULL,
  `assignedByUserId` VARCHAR(36) NOT NULL,
  `department` VARCHAR(100) NOT NULL,
  `assignedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `returnedAt` DATETIME(3) NULL,
  `conditionAtAssignment` ENUM('NEW', 'EXCELLENT', 'GOOD', 'FAIR', 'DAMAGED') NOT NULL,
  `conditionAtReturn` ENUM('NEW', 'EXCELLENT', 'GOOD', 'FAIR', 'DAMAGED') NULL,
  `notes` TEXT NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_aa_unit` FOREIGN KEY (`assetUnitId`) REFERENCES `asset_units` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_aa_user` FOREIGN KEY (`assignedToUserId`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_aa_assigner` FOREIGN KEY (`assignedByUserId`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 13. Stock Opname & Details
CREATE TABLE IF NOT EXISTS `stock_opnames` (
  `id` VARCHAR(36) NOT NULL,
  `opnameNumber` VARCHAR(100) NOT NULL,
  `warehouseId` VARCHAR(36) NOT NULL,
  `scheduledDate` DATE NOT NULL,
  `status` ENUM('DRAFT', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
  `notes` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `opname_number_unique` (`opnameNumber`),
  CONSTRAINT `fk_opn_warehouse` FOREIGN KEY (`warehouseId`) REFERENCES `warehouses` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `stock_opname_details` (
  `id` VARCHAR(36) NOT NULL,
  `opnameId` VARCHAR(36) NOT NULL,
  `itemId` VARCHAR(36) NOT NULL,
  `systemStock` INT NOT NULL,
  `physicalStock` INT NOT NULL,
  `difference` INT NOT NULL,
  `unitCost` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `discrepancyValue` DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
  `notes` VARCHAR(255) NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_opnd_opname` FOREIGN KEY (`opnameId`) REFERENCES `stock_opnames` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_opnd_item` FOREIGN KEY (`itemId`) REFERENCES `items` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 14. Item Requests Table
CREATE TABLE IF NOT EXISTS `item_requests` (
  `id` VARCHAR(36) NOT NULL,
  `requestNumber` VARCHAR(100) NOT NULL,
  `department` VARCHAR(100) NOT NULL,
  `urgency` ENUM('LOW', 'NORMAL', 'HIGH', 'URGENT') NOT NULL DEFAULT 'NORMAL',
  `status` ENUM('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'FULFILLED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
  `reason` TEXT NOT NULL,
  `requestedByUserId` VARCHAR(36) NOT NULL,
  `approvedByUserId` VARCHAR(36) NULL,
  `approvedAt` DATETIME(3) NULL,
  `rejectionReason` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `req_number_unique` (`requestNumber`),
  CONSTRAINT `fk_ir_requester` FOREIGN KEY (`requestedByUserId`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_ir_approver` FOREIGN KEY (`approvedByUserId`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `item_request_details` (
  `id` VARCHAR(36) NOT NULL,
  `requestId` VARCHAR(36) NOT NULL,
  `itemId` VARCHAR(36) NOT NULL,
  `requestedQty` INT NOT NULL,
  `approvedQty` INT NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_ird_request` FOREIGN KEY (`requestId`) REFERENCES `item_requests` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_ird_item` FOREIGN KEY (`itemId`) REFERENCES `items` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 15. Audit Logs Table
CREATE TABLE IF NOT EXISTS `audit_logs` (
  `id` VARCHAR(36) NOT NULL,
  `action` VARCHAR(100) NOT NULL,
  `entity` VARCHAR(100) NOT NULL,
  `entityId` VARCHAR(100) NULL,
  `userId` VARCHAR(36) NULL,
  `userName` VARCHAR(191) NULL,
  `ipAddress` VARCHAR(50) NULL,
  `detailsJson` JSON NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `audit_entity_idx` (`entity`, `entityId`),
  KEY `audit_created_idx` (`createdAt`),
  CONSTRAINT `fk_audit_user` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
