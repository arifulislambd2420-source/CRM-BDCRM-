-- AlterTable: add channel identity fields to customers
ALTER TABLE `customers`
  ADD COLUMN `whatsapp_wa_id`        VARCHAR(191) NULL,
  ADD COLUMN `messenger_psid`        VARCHAR(191) NULL,
  ADD COLUMN `messenger_page_id`     VARCHAR(191) NULL,
  ADD COLUMN `ctwa_clid`             VARCHAR(191) NULL,
  ADD COLUMN `first_contact_channel` VARCHAR(191) NULL,
  ADD COLUMN `first_contact_at`      DATETIME(3)  NULL;

-- UniqueIndex on whatsapp_wa_id
CREATE UNIQUE INDEX `customers_whatsapp_wa_id_key` ON `customers`(`whatsapp_wa_id`);

-- CreateTable: orders
CREATE TABLE `orders` (
  `id`                     VARCHAR(191) NOT NULL,
  `customer_id`            VARCHAR(191) NOT NULL,
  `status`                 ENUM('pending','confirmed','cancelled') NOT NULL DEFAULT 'pending',
  `total_original_amount`  DECIMAL(12,2) NOT NULL,
  `total_discounted_amount` DECIMAL(12,2) NOT NULL,
  `total_paid`             DECIMAL(12,2) NOT NULL DEFAULT 0,
  `total_due`              DECIMAL(12,2) NOT NULL,
  `notes`                  TEXT         NULL,
  `created_by_id`          VARCHAR(191) NOT NULL,
  `created_at`             DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at`             DATETIME(3)  NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `orders_customer_id_idx` (`customer_id`),
  INDEX `orders_status_idx` (`status`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: order_items
CREATE TABLE `order_items` (
  `id`                   VARCHAR(191) NOT NULL,
  `order_id`             VARCHAR(191) NOT NULL,
  `product_id`           VARCHAR(191) NOT NULL,
  `quantity`             INT          NOT NULL,
  `unit_original_price`  DECIMAL(12,2) NOT NULL,
  `unit_discounted_price` DECIMAL(12,2) NOT NULL,
  `line_total`           DECIMAL(12,2) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `order_items_order_id_idx` (`order_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: payments
CREATE TABLE `payments` (
  `id`             VARCHAR(191) NOT NULL,
  `order_id`       VARCHAR(191) NOT NULL,
  `amount`         DECIMAL(12,2) NOT NULL,
  `payment_date`   DATETIME(3)  NOT NULL,
  `payment_method` VARCHAR(191) NOT NULL,
  `note`           TEXT         NULL,
  `recorded_by_id` VARCHAR(191) NOT NULL,
  `created_at`     DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `payments_order_id_idx` (`order_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: stock_movements
CREATE TABLE `stock_movements` (
  `id`         VARCHAR(191) NOT NULL,
  `product_id` VARCHAR(191) NOT NULL,
  `order_id`   VARCHAR(191) NULL,
  `change`     INT          NOT NULL,
  `reason`     VARCHAR(191) NOT NULL,
  `created_at` DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `stock_movements_product_id_idx` (`product_id`),
  INDEX `stock_movements_order_id_idx` (`order_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: integration_accounts
CREATE TABLE `integration_accounts` (
  `id`                  VARCHAR(191) NOT NULL,
  `account_type`        ENUM('whatsapp','messenger') NOT NULL,
  `label`               VARCHAR(191) NOT NULL,
  `active`              BOOLEAN      NOT NULL DEFAULT true,
  `created_at`          DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at`          DATETIME(3)  NOT NULL,
  `waba_id`             VARCHAR(191) NULL,
  `phone_number_id`     VARCHAR(191) NULL,
  `page_id`             VARCHAR(191) NULL,
  `app_id`              VARCHAR(191) NULL,
  `app_secret`          TEXT         NULL,
  `access_token`        TEXT         NULL,
  `webhook_verify_token` VARCHAR(191) NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey: orders → customers
ALTER TABLE `orders`
  ADD CONSTRAINT `orders_customer_id_fkey`
  FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: orders → users
ALTER TABLE `orders`
  ADD CONSTRAINT `orders_created_by_id_fkey`
  FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: order_items → orders
ALTER TABLE `order_items`
  ADD CONSTRAINT `order_items_order_id_fkey`
  FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: order_items → products
ALTER TABLE `order_items`
  ADD CONSTRAINT `order_items_product_id_fkey`
  FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: payments → orders
ALTER TABLE `payments`
  ADD CONSTRAINT `payments_order_id_fkey`
  FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: payments → users
ALTER TABLE `payments`
  ADD CONSTRAINT `payments_recorded_by_id_fkey`
  FOREIGN KEY (`recorded_by_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: stock_movements → products
ALTER TABLE `stock_movements`
  ADD CONSTRAINT `stock_movements_product_id_fkey`
  FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: stock_movements → orders
ALTER TABLE `stock_movements`
  ADD CONSTRAINT `stock_movements_order_id_fkey`
  FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
