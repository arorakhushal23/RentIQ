# RentIQ — Database Provisioning & Deployment Guide

## 1. Prerequisites & Environment Specifications

The RentIQ database tier is built on MySQL 8.0+ (or MariaDB 10.5+ equivalent) utilizing the `InnoDB` storage engine for ACID compliance, row-level locking, and foreign key enforcement.

### 1.1 Server Requirements
- **Database Engine:** MySQL Server 8.0.28 or later
- **Storage Engine:** `InnoDB` (Mandatory; MyISAM is strictly unsupported due to absence of foreign keys and row transactions)
- **Character Set:** `utf8mb4`
- **Collation:** `utf8mb4_unicode_ci`
- **Runtime Environment:** Node.js v18.0.0+ and npm v9.0.0+

---

## 2. Environment Configuration

1. In the `backend/` directory, copy the example environment file:
   ```bash
   cp backend/.env.example backend/.env
   ```

2. Configure database connection parameters in `backend/.env`:
   ```env
   # Database Configuration
   DB_HOST=localhost
   DB_PORT=3306
   DB_USER=rentiq_app
   DB_PASSWORD=your_secure_password_here
   DB_NAME=rentiq

   # JWT & Security
   JWT_SECRET=your_jwt_secret_key_minimum_32_characters
   JWT_EXPIRES_IN=7d

   # Server Port
   PORT=5000
   NODE_ENV=production
   ```

> [!CAUTION]
> Never commit real database passwords or JWT secrets to version control. The `.env` file must remain strictly excluded in `.gitignore`.

---

## 3. Database Initialization & Step-by-Step Migrations

### Step 1: Create Database & Dedicated Application User
Open MySQL CLI or administrative client:
```sql
CREATE DATABASE rentiq 
  CHARACTER SET utf8mb4 
  COLLATE utf8mb4_unicode_ci;

CREATE USER 'rentiq_app'@'localhost' IDENTIFIED BY 'your_secure_password_here';
GRANT ALL PRIVILEGES ON rentiq.* TO 'rentiq_app'@'localhost';
FLUSH PRIVILEGES;
```

---

### Step 2: Execute Sequential Migrations
RentIQ migrations are idempotent and executed sequentially from the `backend/` directory:

1. **Base Platform Schema:**
   Initializes core tables (`users`, `categories`, `vehicles`, `bookings`, `payments`, `reviews`, `wishlist`).
   ```bash
   node backend/scripts/runMigration.js
   ```

2. **Enhancement Suite (Agreements, Inspections & Delivery):**
   Provisions `rental_agreements`, `vehicle_inspections`, `inspection_photos`, `service_hubs`, `delivery_pricing_rules`.
   ```bash
   node backend/scripts/runEnhancementMigration.js
   ```

3. **Phase 2 Schema (Dynamic Pricing Engine):**
   Provisions `pricing_rules`, `seasonal_pricing`, `booking_price_breakdown`, `booking_additional_charges`, `additional_charge_rules`.
   ```bash
   node backend/scripts/runPhase2Migration.js
   ```

4. **Phase 3 Schema (Maintenance & Fleet Service):**
   Provisions `vehicle_maintenance`, `maintenance_reminders`.
   ```bash
   node backend/scripts/runPhase3Migration.js
   ```

5. **Security Suite (Password Reset Tokens):**
   Provisions `password_reset_tokens` with cryptographic hash indices.
   ```bash
   node backend/scripts/runPasswordResetMigration.js
   ```

6. **Document Management & Governance Suite:**
   Provisions `document_verification_logs`, `vehicle_document_versions`, `customer_license_history`, and adds `version` counters to `vehicle_documents` and `customer_licenses`.
   ```bash
   node backend/scripts/runDocumentManagementMigration.js
   ```

---

### Step 3: Seed Initial Administrator Account
Create the initial system administrator credentials:
```bash
node backend/scripts/createAdmin.js
```
*Alternatively, promote an existing customer account:*
```bash
node backend/scripts/promoteAdmin.js <user_email>
```

---

## 4. Post-Deployment Verification Queries

Connect to the database and verify schema integrity:

### 4.1 Verify Table Count (Must Equal 27)
```sql
SELECT COUNT(*) AS total_tables 
FROM INFORMATION_SCHEMA.TABLES 
WHERE TABLE_SCHEMA = 'rentiq';
-- Expected Output: 27
```

### 4.2 Verify Foreign Key Constraints (Must Equal 29)
```sql
SELECT COUNT(*) AS total_foreign_keys 
FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
WHERE TABLE_SCHEMA = 'rentiq' AND REFERENCED_TABLE_NAME IS NOT NULL;
-- Expected Output: 29
```

### 4.3 Verify Active Document Indexes
```sql
SHOW INDEX FROM vehicle_documents WHERE Key_name IN ('idx_veh_doc_expiry', 'idx_veh_doc_type');
SHOW INDEX FROM document_verification_logs WHERE Key_name IN ('idx_doc_verif_doc', 'idx_doc_verif_created');
```

---

## 5. Automated Background Scanner Verification

The automated document compliance daemon starts automatically upon application boot. Verify by checking server startup logs:
```
[DocumentExpiryService] Starting background document expiry scheduler (interval: 43200000ms)...
[DocumentExpiryService] Running fleet document and license expiry scan...
[DocumentExpiryService] Completed fleet scan: X vehicles checked, Y alerts created.
```

To manually trigger a compliance sweep at any time:
```bash
curl -X POST http://localhost:5000/api/admin/documents/scan-expiry \
  -H "Authorization: Bearer <ADMIN_JWT_TOKEN>"
```

---

## 6. Backup, Restoration & Maintenance Procedures

### 6.1 Daily Logical Backup (`mysqldump`)
Run an atomic, non-locking backup using single-transaction mode:
```bash
mysqldump -u rentiq_app -p \
  --single-transaction \
  --quick \
  --routines \
  --triggers \
  rentiq > /backups/rentiq_backup_$(date +\%F).sql
```

### 6.2 Database Restoration
```bash
mysql -u rentiq_app -p rentiq < /backups/rentiq_backup_YYYY-MM-DD.sql
```

### 6.3 Periodic Table Optimization
To reclaim B-tree space following high test volumes:
```sql
OPTIMIZE TABLE bookings, vehicle_documents, customer_licenses, notifications;
```

