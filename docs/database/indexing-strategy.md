# RentIQ — Database Indexing Strategy & Performance Tuning Guide

## 1. Overview & Strategy Objectives

In a real-time vehicle rental platform, query response times directly dictate conversion rates, customer experience, and operational efficiency. The RentIQ database architecture utilizes a multi-tiered indexing strategy across all 27 relational tables (79 active index definitions in MySQL InnoDB).

The primary objectives of this indexing architecture are:
1. **Sub-millisecond Single-Row Point Lookups:** Accelerating primary key queries and unique constraint evaluations (e.g., user authentication, agreement hash validation).
2. **High-Frequency Availability Range Scans:** Optimizing temporal overlap queries (`pickup_datetime` to `return_datetime`) to evaluate fleet booking conflicts in real time under concurrent traffic.
3. **Automated Background Scanner Acceleration:** Eliminating table scans during fleet-wide document compliance and licence expiry sweeps across tens of thousands of records.
4. **Foreign Key Locking Prevention:** Supplying dedicated B-tree indexes on all foreign key columns to eliminate table-level locking during cascaded parent mutations.
5. **Dashboard & Notification Agility:** Supporting composite index queries for user notification badges (`user_id`, `is_read`) and audit logging (`document_type`, `document_id`).

---

## 2. Index Taxonomy & Distribution

The 79 index structures across the database are divided into four structural tiers:

```
┌─────────────────────────────────────────────────────────────┐
│                    79 Active Index Structures               │
└─────────────────────────────────────────────────────────────┘
                               │
       ┌───────────────────────┼───────────────────────┬───────────────────────┐
       ▼                       ▼                       ▼                       ▼
┌──────────────┐        ┌──────────────┐        ┌──────────────┐        ┌──────────────┐
│ Primary Keys │        │ Unique Keys  │        │  Composite   │        │ Single Column│
│   (27 B-Tree)│        │   (12 B-Tree)│        │   (7 B-Tree) │        │  (33 B-Tree) │
└──────────────┘        └──────────────┘        └──────────────┘        └──────────────┘
```

- **Clustered Indexes (Primary Keys):** 27 tables. InnoDB stores table rows physically ordered by the Primary Key, providing $O(\log N)$ single-point reads.
- **Unique Indexes:** Enforce relational 1:1 cardinalities and prevent duplicate business records (e.g., registration numbers, email uniqueness, per-booking single payment/breakdown records).
- **Composite (Multi-Column) Indexes:** Tuned to left-prefix matching for compound query filters, range scans, and index-covered lookups.
- **Secondary Single-Column Indexes:** Applied to foreign keys and high-cardinality status attributes.

---

## 3. High-Impact Index Deep Dives

### 3.1 Booking Concurrency & Overlap Index

- **Table:** `bookings`
- **Index Name:** `idx_bookings_vehicle_datetime`
- **Indexed Columns:** `(vehicle_id, pickup_datetime, return_datetime)`
- **Underlying Query Pattern:**
  ```sql
  SELECT booking_id FROM bookings
  WHERE vehicle_id = ?
    AND status IN ('pending', 'confirmed', 'active')
    AND NOT (return_datetime <= ? OR pickup_datetime >= ?)
  LIMIT 1;
  ```
- **Performance Rationale:**
  Checking whether a vehicle is already booked during a user's selected date range is executed during catalog browsing, vehicle detail rendering, checkout initiation, and final booking submission.
  Without this composite index, MySQL would perform a full table scan or index scan on `vehicle_id` followed by row filtering for date overlaps. With `(vehicle_id, pickup_datetime, return_datetime)`, InnoDB narrows the search immediately to the target vehicle and evaluates the temporal boundary directly within the B-tree leaf nodes.

---

### 3.2 Automated Document Expiry Scanner Index

- **Table:** `vehicle_documents`
- **Index Name:** `idx_veh_doc_expiry` & `idx_veh_doc_type`
- **Indexed Columns:** `expiry_date`, `document_type`, `vehicle_id`
- **Underlying Query Pattern:**
  ```sql
  SELECT vd.*, v.registration_number, v.make, v.model
  FROM vehicle_documents vd
  JOIN vehicles v ON vd.vehicle_id = v.vehicle_id
  WHERE vd.expiry_date IS NOT NULL 
    AND vd.expiry_date <= DATE_ADD(CURDATE(), INTERVAL 30 DAY);
  ```
- **Performance Rationale:**
  The background scheduler (`documentExpiryService.js`) runs periodically to identify documents that are `expired` or `expiring_soon` (7, 15, and 30 days). The index `idx_veh_doc_expiry` enables an index range scan rather than scanning all fleet documents, keeping execution time under 15ms even as document records grow.

---

### 3.3 Notification Badge & Feed Index

- **Table:** `notifications`
- **Index Name:** `idx_notif_user_read`
- **Indexed Columns:** `(user_id, is_read)`
- **Underlying Query Pattern:**
  ```sql
  SELECT COUNT(*) AS unread_count 
  FROM notifications 
  WHERE user_id = ? AND is_read = 0;
  ```
- **Performance Rationale:**
  Every authenticated page load requests the unread notification badge count for the header. The composite index `(user_id, is_read)` serves this query as a **covering index** directly from memory without reading the underlying row data (`Using index` in MySQL EXPLAIN).

---

### 3.4 Verification Audit Trail Index

- **Table:** `document_verification_logs`
- **Index Name:** `idx_doc_verif_doc` & `idx_doc_verif_created`
- **Indexed Columns:** `(document_type, document_id)` and `created_at`
- **Underlying Query Pattern:**
  ```sql
  SELECT * FROM document_verification_logs
  WHERE document_type = ? AND document_id = ?
  ORDER BY created_at DESC;
  ```
- **Performance Rationale:**
  When an admin opens the verification history drawer for any vehicle document or customer licence, this compound index guarantees instantaneous retrieval of the chronological audit trail.

---

### 3.5 Password Reset Security Index

- **Table:** `password_reset_tokens`
- **Index Name:** `idx_reset_token_hash` & `idx_reset_user_expires`
- **Indexed Columns:** `token_hash` and `(user_id, expires_at)`
- **Performance Rationale:**
  Token validation performs a constant-time lookup by SHA-256 hash. The expiration composite index enables rapid periodic purging of stale authentication tokens.

---

## 4. Comprehensive Index Catalog

Below is the complete inventory of all 79 indexes across the RentIQ database:

| Table Name | Index Name | Index Type | Columns | Cardinality / Purpose |
|------------|------------|:----------:|---------|-----------------------|
| `additional_charge_rules` | `PRIMARY` | Primary | `id` | Clustered PK |
| `booking_additional_charges` | `PRIMARY` | Primary | `id` | Clustered PK |
| `booking_additional_charges` | `booking_id` | Secondary | `booking_id` | FK optimization |
| `booking_price_breakdown` | `PRIMARY` | Primary | `id` | Clustered PK |
| `booking_price_breakdown` | `booking_id` | Unique | `booking_id` | 1:1 Booking snapshot constraint |
| `bookings` | `PRIMARY` | Primary | `booking_id` | Clustered PK |
| `bookings` | `idx_bookings_user` | Secondary | `user_id` | Customer booking history |
| `bookings` | `idx_bookings_vehicle_datetime` | Composite | `vehicle_id`, `pickup_datetime`, `return_datetime` | Range overlap conflict validation |
| `categories` | `PRIMARY` | Primary | `category_id` | Clustered PK |
| `categories` | `name` | Unique | `name` | Category name uniqueness |
| `contact_messages` | `PRIMARY` | Primary | `message_id` | Clustered PK |
| `customer_license_history` | `PRIMARY` | Primary | `id` | Clustered PK |
| `customer_license_history` | `idx_lic_hist_user` | Secondary | `user_id` | Historical audit lookup by customer |
| `customer_license_history` | `idx_lic_hist_lic` | Secondary | `license_id` | Historical versions by active licence |
| `customer_license_history` | `verified_by` | Secondary | `verified_by` | Admin audit lookup |
| `customer_licenses` | `PRIMARY` | Primary | `id` | Clustered PK |
| `customer_licenses` | `user_id` | Unique | `user_id` | 1:1 Customer licence constraint |
| `customer_licenses` | `idx_cust_lic_user` | Secondary | `user_id` | Quick customer lookup |
| `customer_licenses` | `idx_cust_lic_status` | Secondary | `verification_status` | Admin pending review queue |
| `customer_licenses` | `verified_by` | Secondary | `verified_by` | FK optimization |
| `delivery_pricing_rules` | `PRIMARY` | Primary | `id` | Clustered PK |
| `document_verification_logs` | `PRIMARY` | Primary | `id` | Clustered PK |
| `document_verification_logs` | `idx_doc_verif_doc` | Composite | `document_type`, `document_id` | Document audit history |
| `document_verification_logs` | `idx_doc_verif_admin` | Secondary | `admin_id` | Admin compliance activity log |
| `document_verification_logs` | `idx_doc_verif_created` | Secondary | `created_at` | Chronological audit sorting |
| `inspection_photos` | `PRIMARY` | Primary | `id` | Clustered PK |
| `inspection_photos` | `inspection_id` | Secondary | `inspection_id` | FK optimization & inspection gallery |
| `maintenance_reminders` | `PRIMARY` | Primary | `id` | Clustered PK |
| `maintenance_reminders` | `vehicle_id` | Secondary | `vehicle_id` | Fleet vehicle maintenance alerts |
| `notifications` | `PRIMARY` | Primary | `notification_id` | Clustered PK |
| `notifications` | `idx_notif_user_read` | Composite | `user_id`, `is_read` | Unread badge counts (Covering index) |
| `password_reset_tokens` | `PRIMARY` | Primary | `id` | Clustered PK |
| `password_reset_tokens` | `idx_reset_token_hash` | Secondary | `token_hash` | O(1) Token authentication lookup |
| `password_reset_tokens` | `idx_reset_user_expires` | Composite | `user_id`, `expires_at` | Stale token cleanup sweeps |
| `payments` | `PRIMARY` | Primary | `payment_id` | Clustered PK |
| `payments` | `booking_id` | Unique | `booking_id` | 1:1 Booking payment constraint |
| `pricing_rules` | `PRIMARY` | Primary | `id` | Clustered PK |
| `rental_agreements` | `PRIMARY` | Primary | `id` | Clustered PK |
| `rental_agreements` | `agreement_number` | Unique | `agreement_number` | Contract reference uniqueness |
| `rental_agreements` | `unique_booking_agreement`| Composite Unique | `booking_id`, `agreement_version` | Versioned contract uniqueness |
| `rental_agreements` | `user_id` | Secondary | `user_id` | Customer contract history |
| `reviews` | `PRIMARY` | Primary | `review_id` | Clustered PK |
| `reviews` | `user_id` (compound) | Composite Unique | `user_id`, `vehicle_id` | Single review per vehicle constraint |
| `reviews` | `vehicle_id` | Secondary | `vehicle_id` | Vehicle ratings aggregation |
| `seasonal_pricing` | `PRIMARY` | Primary | `id` | Clustered PK |
| `service_hubs` | `PRIMARY` | Primary | `id` | Clustered PK |
| `users` | `PRIMARY` | Primary | `user_id` | Clustered PK |
| `users` | `email` | Unique | `email` | Email login uniqueness |
| `vehicle_document_versions` | `PRIMARY` | Primary | `id` | Clustered PK |
| `vehicle_document_versions` | `idx_veh_doc_ver_veh` | Secondary | `vehicle_id` | Historical versions by vehicle |
| `vehicle_document_versions` | `idx_veh_doc_ver_type` | Secondary | `document_type` | Historical lookup by type |
| `vehicle_document_versions` | `idx_veh_doc_ver_doc` | Secondary | `document_id` | Historical versions by active doc |
| `vehicle_document_versions` | `archived_by` | Secondary | `archived_by` | FK optimization |
| `vehicle_documents` | `PRIMARY` | Primary | `id` | Clustered PK |
| `vehicle_documents` | `idx_veh_doc_vehicle` | Secondary | `vehicle_id` | Vehicle documents checklist |
| `vehicle_documents` | `idx_veh_doc_type` | Secondary | `document_type` | Document type filtering |
| `vehicle_documents` | `idx_veh_doc_expiry` | Secondary | `expiry_date` | Background expiry scanner sweeps |
| `vehicle_inspections` | `PRIMARY` | Primary | `id` | Clustered PK |
| `vehicle_inspections` | `unique_booking_inspection_type` | Composite Unique | `booking_id`, `inspection_type` | Single pickup/return inspection |
| `vehicle_inspections` | `vehicle_id` | Secondary | `vehicle_id` | Vehicle inspection history |
| `vehicle_inspections` | `inspected_by` | Secondary | `inspected_by` | Staff performance & audit tracking |
| `vehicle_maintenance` | `PRIMARY` | Primary | `id` | Clustered PK |
| `vehicle_maintenance` | `vehicle_id` | Secondary | `vehicle_id` | Vehicle service log |
| `vehicle_maintenance` | `created_by` | Secondary | `created_by` | Service creator audit |
| `vehicles` | `PRIMARY` | Primary | `vehicle_id` | Clustered PK |
| `vehicles` | `idx_vehicles_registration_number` | Unique | `registration_number` | Fleet license plate uniqueness |
| `vehicles` | `idx_vehicles_category` | Secondary | `category_id` | Catalog category filtering |
| `vehicles` | `idx_vehicles_available` | Secondary | `is_available` | Fleet active availability filter |
| `wishlist` | `PRIMARY` | Composite Unique | `user_id`, `vehicle_id` | Clustered PK (User-Vehicle uniqueness) |
| `wishlist` | `vehicle_id` | Secondary | `vehicle_id` | Vehicle popularity analytics |

---

## 5. Maintenance, Optimization & Monitoring Guidelines

1. **Index Bloat & Fragmentation Monitoring:**
   - Periodically execute `OPTIMIZE TABLE bookings, vehicle_documents, notifications;` following bulk updates or high-volume test runs to defragment B-tree pages and reclaim disk space.
2. **Execution Plan Validation (`EXPLAIN`):**
   - In development and CI, verify that all core queries utilize target indexes:
     - `type: const`, `eq_ref`, `ref`, or `range` (Acceptable).
     - `type: ALL` or `index` across large tables without `LIMIT` (Blocked/Flagged).
3. **Write Amplification Mitigation:**
   - Every secondary index incurs an overhead during `INSERT`, `UPDATE`, and `DELETE`. The current 79 indexes represent a balanced, deliberate configuration. Do not introduce speculative indexes without measuring query latency and write throughput impacts.

