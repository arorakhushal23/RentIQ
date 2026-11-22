# RentIQ Database Design & Architecture Specification

## 1. Architectural Philosophy

The RentIQ database design follows industry standards for mission-critical e-commerce, mobility, and financial asset management systems:

1. **Third Normal Form (3NF) Baseline:** Core entity relationships (users, vehicles, categories, maintenance, documents) are fully normalized to eliminate update anomalies and data duplication.
2. **Intentional Denormalization for Financial & Legal Immutability:** Financial snapshots (`booking_price_breakdown`, `rental_agreements`) freeze dynamic rules, rates, addresses, and customer names at confirmation time to prevent retro-active modification when pricing or customer profile records change.
3. **Pessimistic Concurrency Control:** High-contention reservation workflows utilize MySQL InnoDB row-level locking (`SELECT ... FOR UPDATE`) inside database transactions to completely eliminate race conditions and double-booking bugs.
4. **Defense in Depth Integrity:** Business rules are enforced at both the API/application layer and the database layer through `FOREIGN KEY`, `UNIQUE`, `NOT NULL`, and `ENUM` constraints.

---

## 2. Normalization & Entity Isolation

### 2.1 Vehicle Lifecycle Normalization
Vehicles are separated into logical entity layers:
- **Taxonomy:** `categories` holds high-level groupings (SUV, Sedan, Sports, Bike).
- **Physical Asset:** `vehicles` holds immutable hardware specs (VIN, engine number, chassis number, seating, transmission) and operational rates.
- **Compliance Artifacts:** `vehicle_documents` holds active certificates (RC, insurance, PUC).
- **Historical Audit:** `vehicle_document_versions` archives superseded documents upon renewal.
- **Maintenance Records:** `vehicle_maintenance` tracks servicing intervals, costs, and downtime windows.

### 2.2 Customer & Verification Separation
- `users` stores foundational identity and credentials without polluting customer profiles with transient document state.
- `customer_licenses` maintains current verification status (`not_submitted`, `pending`, `verified`, `rejected`, `expired`), authorized class, and document paths.
- `customer_license_history` stores previous submissions when a customer resubmits or renews their licence.
- `document_verification_logs` records administrator verification actions, remarks, and timestamps without modifying core identity records.

---

## 3. Concurrency Control & Double-Booking Prevention

### The Overlapping Booking Problem
In vehicle rental systems, two customers might attempt to book the same vehicle for overlapping time slots concurrently. If naive read-then-write logic is used, both requests could pass availability checks simultaneously.

### RentIQ Solution: Serialized Row-Level Locking
RentIQ resolves this inside `backend/controllers/bookingController.js` using transactional row locking:

```sql
START TRANSACTION;

-- 1. Lock the target vehicle row to serialize concurrent booking attempts
SELECT vehicle_id, price_per_day, is_available
FROM vehicles
WHERE vehicle_id = ?
FOR UPDATE;

-- 2. Verify no overlapping reservations exist in active states
SELECT booking_id
FROM bookings
WHERE vehicle_id = ?
  AND status IN ('pending', 'confirmed', 'active')
  AND pickup_datetime < ?
  AND return_datetime > ?
LIMIT 1;

-- 3. If overlap detected -> ROLLBACK and return HTTP 409 Conflict
-- 4. If clear -> INSERT INTO bookings and COMMIT
```

### Supported Overlap Scenarios
- **Complete Containment:** `[pickup_req, return_req]` inside existing `[pickup_db, return_db]` -> Blocked (409).
- **Partial Start Overlap:** `pickup_req` starts before `return_db` -> Blocked (409).
- **Partial End Overlap:** `return_req` ends after `pickup_db` -> Blocked (409).
- **Adjacent Reservations:** Next rental starts at the exact minute the previous rental ends (`pickup_req == return_db`) -> Allowed.
- **Cancelled/Completed Rentals:** Inactive bookings (`cancelled`, `completed`, `refunded`) are ignored by the lock guard -> Allowed.

---

## 4. Financial & Audit Immutability Patterns

When a booking is confirmed, the system calculates pricing using current rules from `pricing_rules`, `delivery_pricing_rules`, and `seasonal_pricing`.

To ensure total audit compliance:
1. An immutable record is created in `booking_price_breakdown`:
   ```sql
   INSERT INTO booking_price_breakdown (
       booking_id, base_rental_price, duration_discount_amount,
       weekend_surcharge_amount, seasonal_surcharge_amount,
       delivery_charge_amount, add_ons_amount, security_deposit_amount,
       tax_amount, total_final_price
   ) VALUES (...);
   ```
2. A digital rental agreement is generated and locked in `rental_agreements` with the agreement number, customer snapshot, and hashed PDF path.
3. Subsequent administrative modifications to global pricing rules will **never** alter the historical invoice or agreement for confirmed bookings.

---

## 5. Storage Engine Configuration & Integrity Rules

- **Engine:** `InnoDB` across all 27 tables.
- **Foreign Key Actions:**
  - Cascading Deletes (`ON DELETE CASCADE`): Used on child dependencies where child records cannot exist without their parent (e.g. `vehicle_documents -> vehicles`, `inspection_photos -> vehicle_inspections`, `booking_price_breakdown -> bookings`).
  - Nullification (`ON DELETE SET NULL`): Used on administrative tracking foreign keys (`verified_by -> users`, `inspected_by -> users`, `archived_by -> users`) to preserve operational history even if an administrator account is deleted.
- **Strict Mode:** MySQL `STRICT_TRANS_TABLES` and `NO_ZERO_DATE` are enforced to prevent silent truncation or zero-date corruption.

