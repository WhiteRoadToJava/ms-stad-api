-- CreateTable
CREATE TABLE `services` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `slug` VARCHAR(80) NOT NULL,
    `category` ENUM('PRIVATE', 'BUSINESS') NOT NULL,
    `pricingModel` ENUM('PER_SQM', 'HOURLY', 'PACKAGE', 'QUOTE_ONLY') NOT NULL,
    `pricePerSqm` INTEGER NULL,
    `minPrice` INTEGER NULL,
    `hourlyRate` INTEGER NULL,
    `packagePrice` INTEGER NULL,
    `rutEligible` BOOLEAN NOT NULL DEFAULT false,
    `isPopular` BOOLEAN NOT NULL DEFAULT false,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `services_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `service_translations` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `serviceId` INTEGER NOT NULL,
    `locale` VARCHAR(5) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `shortDescription` VARCHAR(255) NOT NULL,
    `longDescription` TEXT NULL,
    `metaTitle` VARCHAR(160) NULL,
    `metaDescription` VARCHAR(255) NULL,
    `includes` JSON NULL,

    UNIQUE INDEX `service_translations_serviceId_locale_key`(`serviceId`, `locale`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `service_extras` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `serviceId` INTEGER NOT NULL,
    `key` VARCHAR(60) NOT NULL,
    `price` INTEGER NOT NULL,
    `nameSv` VARCHAR(120) NOT NULL,
    `nameEn` VARCHAR(120) NOT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `service_extras_serviceId_key_key`(`serviceId`, `key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `customers` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(120) NOT NULL,
    `email` VARCHAR(160) NOT NULL,
    `phone` VARCHAR(40) NOT NULL,
    `street` VARCHAR(160) NULL,
    `postalCode` VARCHAR(12) NULL,
    `city` VARCHAR(80) NULL,
    `isCompany` BOOLEAN NOT NULL DEFAULT false,
    `orgNumber` VARCHAR(20) NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `customers_email_idx`(`email`),
    INDEX `customers_phone_idx`(`phone`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `bookings` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `reference` VARCHAR(16) NOT NULL,
    `customerId` INTEGER NOT NULL,
    `serviceId` INTEGER NOT NULL,
    `status` ENUM('NEW', 'CONFIRMED', 'SCHEDULED', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'NEW',
    `frequency` ENUM('ONCE', 'WEEKLY', 'BIWEEKLY', 'MONTHLY') NOT NULL DEFAULT 'ONCE',
    `squareMeters` INTEGER NULL,
    `rooms` INTEGER NULL,
    `floor` VARCHAR(20) NULL,
    `hasElevator` BOOLEAN NULL,
    `hasPets` BOOLEAN NULL,
    `scheduledDate` DATE NULL,
    `timeSlotId` INTEGER NULL,
    `basePrice` INTEGER NOT NULL,
    `extrasPrice` INTEGER NOT NULL DEFAULT 0,
    `grossPrice` INTEGER NOT NULL,
    `rutDeduction` INTEGER NOT NULL DEFAULT 0,
    `totalPrice` INTEGER NOT NULL,
    `applyRut` BOOLEAN NOT NULL DEFAULT false,
    `message` TEXT NULL,
    `internalNotes` TEXT NULL,
    `source` VARCHAR(40) NOT NULL DEFAULT 'web',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `bookings_reference_key`(`reference`),
    INDEX `bookings_status_scheduledDate_idx`(`status`, `scheduledDate`),
    INDEX `bookings_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `booking_extras` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `bookingId` INTEGER NOT NULL,
    `extraId` INTEGER NULL,
    `label` VARCHAR(120) NOT NULL,
    `price` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `time_slots` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `date` DATE NOT NULL,
    `startTime` VARCHAR(5) NOT NULL,
    `endTime` VARCHAR(5) NOT NULL,
    `capacity` INTEGER NOT NULL DEFAULT 1,
    `bookedCount` INTEGER NOT NULL DEFAULT 0,
    `isBlocked` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `time_slots_date_isBlocked_idx`(`date`, `isBlocked`),
    UNIQUE INDEX `time_slots_date_startTime_key`(`date`, `startTime`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `quotes` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `reference` VARCHAR(16) NOT NULL,
    `customerId` INTEGER NOT NULL,
    `serviceId` INTEGER NULL,
    `status` ENUM('NEW', 'CONTACTED', 'SENT', 'WON', 'LOST') NOT NULL DEFAULT 'NEW',
    `propertyType` VARCHAR(60) NULL,
    `squareMeters` INTEGER NULL,
    `frequency` ENUM('ONCE', 'WEEKLY', 'BIWEEKLY', 'MONTHLY') NULL,
    `description` TEXT NULL,
    `quotedAmount` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `quotes_reference_key`(`reference`),
    INDEX `quotes_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `callback_requests` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(120) NULL,
    `phone` VARCHAR(40) NOT NULL,
    `handled` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `job_applications` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(120) NOT NULL,
    `email` VARCHAR(160) NOT NULL,
    `phone` VARCHAR(40) NOT NULL,
    `city` VARCHAR(80) NULL,
    `hasDriversLicense` BOOLEAN NOT NULL DEFAULT false,
    `message` TEXT NULL,
    `cvFileName` VARCHAR(255) NULL,
    `handled` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `employees` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(120) NOT NULL,
    `email` VARCHAR(160) NULL,
    `phone` VARCHAR(40) NULL,
    `colour` VARCHAR(9) NOT NULL DEFAULT '#124559',
    `notes` TEXT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `booking_assignments` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `bookingId` INTEGER NOT NULL,
    `employeeId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `booking_assignments_employeeId_idx`(`employeeId`),
    UNIQUE INDEX `booking_assignments_bookingId_employeeId_key`(`bookingId`, `employeeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `admins` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `email` VARCHAR(160) NOT NULL,
    `passwordHash` VARCHAR(255) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `role` ENUM('ADMIN', 'STAFF') NOT NULL DEFAULT 'STAFF',
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `mustChangePassword` BOOLEAN NOT NULL DEFAULT false,
    `lastLoginAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `admins_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `settings` (
    `key` VARCHAR(60) NOT NULL,
    `value` TEXT NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `service_translations` ADD CONSTRAINT `service_translations_serviceId_fkey` FOREIGN KEY (`serviceId`) REFERENCES `services`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `service_extras` ADD CONSTRAINT `service_extras_serviceId_fkey` FOREIGN KEY (`serviceId`) REFERENCES `services`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bookings` ADD CONSTRAINT `bookings_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `customers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bookings` ADD CONSTRAINT `bookings_serviceId_fkey` FOREIGN KEY (`serviceId`) REFERENCES `services`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bookings` ADD CONSTRAINT `bookings_timeSlotId_fkey` FOREIGN KEY (`timeSlotId`) REFERENCES `time_slots`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `booking_extras` ADD CONSTRAINT `booking_extras_bookingId_fkey` FOREIGN KEY (`bookingId`) REFERENCES `bookings`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `booking_extras` ADD CONSTRAINT `booking_extras_extraId_fkey` FOREIGN KEY (`extraId`) REFERENCES `service_extras`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `quotes` ADD CONSTRAINT `quotes_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `customers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `quotes` ADD CONSTRAINT `quotes_serviceId_fkey` FOREIGN KEY (`serviceId`) REFERENCES `services`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `booking_assignments` ADD CONSTRAINT `booking_assignments_bookingId_fkey` FOREIGN KEY (`bookingId`) REFERENCES `bookings`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `booking_assignments` ADD CONSTRAINT `booking_assignments_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `employees`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

