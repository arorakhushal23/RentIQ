# RentIQ — Database Entity Relationships & Foreign Key Architecture

## 1. Executive Summary

The RentIQ database architecture utilizes a relational model enforced at the storage engine level (`InnoDB` in MySQL 8.0+). Referential integrity is strictly maintained through 29 explicit Foreign Key (FK) constraints across 27 tables. These constraints guarantee transactional consistency, eliminate orphaned records, preserve critical financial and audit trails, and enforce domain governance rules.

This document provides a comprehensive technical reference for all foreign key relationships, their cardinalities, cascade behaviors, and the business logic underpinning each design choice.

---

## 2. Referential Integrity & Cascade Design Principles

RentIQ adopts three distinct referential actions depending on the entity lifecycle and regulatory requirements:

1. **`ON DELETE CASCADE` (Orphan Elimination):**
   - Applied to child records that have no independent lifecycle without their parent entity (e.g., `booking_price_breakdown`, `inspection_photos`, `notifications`, `password_reset_tokens`, `wishlist`).
   - When a parent entity is legally deleted or purged, dependent transient records are automatically cleaned up to prevent database bloat.

2. **`ON DELETE RESTRICT` (Financial & Historical Immutability):**
   - Applied to mission-critical business transactions where accidental deletion would compromise historical records or accounting integrity.
   - Example 1: `bookings.vehicle_id -> vehicles.vehicle_id` uses `RESTRICT`. A vehicle cannot be deleted from the database if it has active or historical bookings. It must instead be flagged as `is_available = 0` or soft-decommissioned.
   - Example 2: `vehicles.category_id -> categories.category_id` uses `RESTRICT`. A vehicle category cannot be deleted if vehicles are assigned to it.
   - Example 3: `vehicle_inspections.inspected_by -> users.user_id` uses `RESTRICT`. An inspector's user record cannot be deleted if they signed off on legal condition inspections.

3. **`ON DELETE SET NULL` (Audit Trail Preservation):**
   - Applied to administrative actor references where historical records must survive even if an administrator account is subsequently deprovisioned.
   - Example: `customer_licenses.verified_by`, `customer_license_history.verified_by`, `vehicle_document_versions.archived_by`, and `vehicle_maintenance.created_by`. If an admin account is removed, the verification record remains intact with `verified_by = NULL`, while immutable audit records in `document_verification_logs` continue to capture the historical identifier and timestamps.

4. **`ON UPDATE NO ACTION / RESTRICT`:**
   - Primary Keys in RentIQ are surrogate auto-increment integers or immutable UUIDs. Since primary keys are never mutated, foreign keys specify standard `NO ACTION` (default relational enforcement).

---

## 3. Comprehensive Foreign Key Inventory (29 Relationships)

Below is the complete, verified inventory of all 29 Foreign Key constraints currently active in the RentIQ production database:

| # | Child Table | Foreign Key Column | Parent Table | Parent Key Column | Constraint Name | Cardinality | ON DELETE | ON UPDATE |
|---|-------------|--------------------|--------------|-------------------|-----------------|:-----------:|:---------:|:---------:|
| 1 | `booking_additional_charges` | `booking_id` | `bookings` | `booking_id` | `booking_additional_charges_ibfk_1` | 1 : N | `CASCADE` | `NO ACTION` |
| 2 | `booking_price_breakdown` | `booking_id` | `bookings` | `booking_id` | `booking_price_breakdown_ibfk_1` | 1 : 1 | `CASCADE` | `NO ACTION` |
| 3 | `bookings` | `user_id` | `users` | `user_id` | `bookings_ibfk_1` | 1 : N | `CASCADE` | `NO ACTION` |
| 4 | `bookings` | `vehicle_id` | `vehicles` | `vehicle_id` | `bookings_ibfk_2` | 1 : N | `RESTRICT` | `NO ACTION` |
| 5 | `customer_license_history` | `user_id` | `users` | `user_id` | `customer_license_history_ibfk_1` | 1 : N | `CASCADE` | `NO ACTION` |
| 6 | `customer_license_history` | `verified_by` | `users` | `user_id` | `customer_license_history_ibfk_2` | 1 : N | `SET NULL` | `NO ACTION` |
| 7 | `customer_licenses` | `user_id` | `users` | `user_id` | `customer_licenses_ibfk_1` | 1 : 1 | `CASCADE` | `NO ACTION` |
| 8 | `customer_licenses` | `verified_by` | `users` | `user_id` | `customer_licenses_ibfk_2` | 1 : N | `SET NULL` | `NO ACTION` |
| 9 | `document_verification_logs` | `admin_id` | `users` | `user_id` | `document_verification_logs_ibfk_1` | 1 : N | `CASCADE` | `NO ACTION` |
| 10 | `inspection_photos` | `inspection_id` | `vehicle_inspections` | `id` | `inspection_photos_ibfk_1` | 1 : N | `CASCADE` | `NO ACTION` |
| 11 | `maintenance_reminders` | `vehicle_id` | `vehicles` | `vehicle_id` | `maintenance_reminders_ibfk_1` | 1 : N | `CASCADE` | `NO ACTION` |
| 12 | `notifications` | `user_id` | `users` | `user_id` | `notifications_ibfk_1` | 1 : N | `CASCADE` | `NO ACTION` |
| 13 | `password_reset_tokens` | `user_id` | `users` | `user_id` | `password_reset_tokens_ibfk_1` | 1 : N | `CASCADE` | `NO ACTION` |
| 14 | `payments` | `booking_id` | `bookings` | `booking_id` | `payments_ibfk_1` | 1 : 1 | `CASCADE` | `NO ACTION` |
| 15 | `rental_agreements` | `booking_id` | `bookings` | `booking_id` | `rental_agreements_ibfk_1` | 1 : N | `CASCADE` | `NO ACTION` |
| 16 | `rental_agreements` | `user_id` | `users` | `user_id` | `rental_agreements_ibfk_2` | 1 : N | `CASCADE` | `NO ACTION` |
| 17 | `reviews` | `user_id` | `users` | `user_id` | `reviews_ibfk_1` | 1 : N | `CASCADE` | `NO ACTION` |
| 18 | `reviews` | `vehicle_id` | `vehicles` | `vehicle_id` | `reviews_ibfk_2` | 1 : N | `CASCADE` | `NO ACTION` |
| 19 | `vehicle_document_versions` | `vehicle_id` | `vehicles` | `vehicle_id` | `vehicle_document_versions_ibfk_1` | 1 : N | `CASCADE` | `NO ACTION` |
| 20 | `vehicle_document_versions` | `archived_by` | `users` | `user_id` | `vehicle_document_versions_ibfk_2` | 1 : N | `SET NULL` | `NO ACTION` |
| 21 | `vehicle_documents` | `vehicle_id` | `vehicles` | `vehicle_id` | `vehicle_documents_ibfk_1` | 1 : N | `CASCADE` | `NO ACTION` |
| 22 | `vehicle_inspections` | `booking_id` | `bookings` | `booking_id` | `vehicle_inspections_ibfk_1` | 1 : N | `CASCADE` | `NO ACTION` |
| 23 | `vehicle_inspections` | `vehicle_id` | `vehicles` | `vehicle_id` | `vehicle_inspections_ibfk_2` | 1 : N | `CASCADE` | `NO ACTION` |
| 24 | `vehicle_inspections` | `inspected_by` | `users` | `user_id` | `vehicle_inspections_ibfk_3` | 1 : N | `RESTRICT` | `NO ACTION` |
| 25 | `vehicle_maintenance` | `vehicle_id` | `vehicles` | `vehicle_id` | `vehicle_maintenance_ibfk_1` | 1 : N | `CASCADE` | `NO ACTION` |
| 26 | `vehicle_maintenance` | `created_by` | `users` | `user_id` | `vehicle_maintenance_ibfk_2` | 1 : N | `SET NULL` | `NO ACTION` |
| 27 | `vehicles` | `category_id` | `categories` | `category_id` | `vehicles_ibfk_1` | 1 : N | `RESTRICT` | `NO ACTION` |
| 28 | `wishlist` | `user_id` | `users` | `user_id` | `wishlist_ibfk_1` | 1 : N | `CASCADE` | `NO ACTION` |
| 29 | `wishlist` | `vehicle_id` | `vehicles` | `vehicle_id` | `wishlist_ibfk_2` | 1 : N | `CASCADE` | `NO ACTION` |

---

## 4. Relationship Details by Domain

### 4.1 User & Identity Relationships

```
              ┌────────────────────────┐
              │         users          │
              └───────────┬────────────┘
                          │
       ┌──────────────────┼─────────────────────────┬─────────────────────────┐
       ▼                  ▼                         ▼                         ▼
┌──────────────┐   ┌──────────────┐          ┌──────────────┐          ┌──────────────┐
│ customer_    │   │ customer_    │          │ password_    │          │ notifications│
│ licenses     │   │ license_hist │          │ reset_tokens │          │              │
└──────────────┘   └──────────────┘          └──────────────┘          └──────────────┘
```

- **`users` -> `customer_licenses` (1 : 1):**
  - Enforced by `UNIQUE KEY (user_id)` on `customer_licenses`.
  - Every customer has at most one active driving licence profile.
  - Cascades on user deletion (`CASCADE`).
- **`users` -> `customer_license_history` (1 : N):**
  - Maintains historical driving licence revisions across renewals or re-submissions.
  - Links to customer via `user_id` (`CASCADE`) and auditing admin via `verified_by` (`SET NULL`).
- **`users` -> `notifications` (1 : N):**
  - Stores system alerts, expiry warnings, and booking status changes.

---

### 4.2 Fleet & Vehicle Domain Relationships

```
┌──────────────────┐
│    categories    │
└─────────┬────────┘
          │ (1:N RESTRICT)
          ▼
┌──────────────────┐
│     vehicles     │
└─────────┬────────┘
          │
    ┌─────┴──────────────────┬────────────────────────┬──────────────────────┐
    ▼                        ▼                        ▼                      ▼
┌──────────────┐      ┌──────────────┐         ┌──────────────┐       ┌──────────────┐
│   vehicle_   │      │   vehicle_   │         │   vehicle_   │       │ maintenance_ │
│  documents   │      │ doc_versions │         │ maintenance  │       │  reminders   │
└──────────────┘      └──────────────┘         └──────────────┘       └──────────────┘
```

- **`categories` -> `vehicles` (1 : N):**
  - Every vehicle belongs to exactly one category (`SUV`, `Sedan`, `Hatchback`, `Luxury`, `Sports`, `Electric`).
  - Deleting a category is blocked (`RESTRICT`) if any fleet vehicles are linked to it.
- **`vehicles` -> `vehicle_documents` (1 : N):**
  - Holds active legal compliance documents (`RC`, `Insurance`, `PUC`, `Fitness`, `Permit`, `Road Tax`).
  - Cascades on vehicle purge (`CASCADE`).
- **`vehicles` -> `vehicle_document_versions` (1 : N):**
  - Archives superseded document records upon renewal or update, keeping an immutable historical paper trail.
- **`vehicles` -> `vehicle_maintenance` & `maintenance_reminders` (1 : N):**
  - Tracks routine servicing, repair history, and scheduled interval alerts.

---

### 4.3 Booking & Financial Domain Relationships

```
┌──────────────┐                        ┌──────────────┐
│    users     │                        │   vehicles   │
└───────┬──────┘                        └──────┬───────┘
        │                                      │
        └──────────────┐        ┌──────────────┘
                       ▼        ▼
                 ┌────────────────────┐
                 │      bookings      │
                 └─────────┬──────────┘
                           │
       ┌───────────────────┼────────────────────┬────────────────────┐
       ▼                   ▼                    ▼                    ▼
┌──────────────┐    ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│booking_price_│    │   payments   │     │ rental_      │     │booking_addtl_│
│  breakdown   │    │              │     │  agreements  │     │   charges    │
└──────────────┘    └──────────────┘     └──────────────┘     └──────────────┘
```

- **`bookings` -> `booking_price_breakdown` (1 : 1):**
  - Enforced by `UNIQUE KEY (booking_id)` on `booking_price_breakdown`.
  - Captures an immutable snapshot of all pricing components (base fare, seasonal surge, delivery charges, platform fee, GST, security deposit) at the exact moment of reservation.
- **`bookings` -> `payments` (1 : 1):**
  - Enforced by `UNIQUE KEY (booking_id)` on `payments`.
  - Records transaction metadata, gateway references (`RAZORPAY`, `STRIPE`), payment status, and timestamps.
- **`bookings` -> `booking_additional_charges` (1 : N):**
  - Holds post-rental reconciliation charges generated during return vehicle inspection (e.g., excess kilometer fees, fuel deficit penalties, damage fees, late return fines).

---

### 4.4 Quality & Inspection Domain Relationships

- **`bookings` + `vehicles` -> `vehicle_inspections` (1 : N):**
  - Captures digital check-in and check-out inspection records (`inspection_type IN ('pickup', 'return')`).
  - Constrained by `UNIQUE KEY unique_booking_inspection_type (booking_id, inspection_type)` — guarantees that a booking can have at most one pickup inspection and one return inspection.
  - Linked to inspector via `inspected_by -> users.user_id` with `RESTRICT` to prevent tampering with historical inspection attestation.
- **`vehicle_inspections` -> `inspection_photos` (1 : N):**
  - Stores high-resolution photographic evidence for 360-degree vehicle body panels, odometer reading, and fuel gauge.
  - Cascades on inspection deletion (`CASCADE`).

---

### 4.5 Governance & Audit Trail Relationships

- **`users` -> `document_verification_logs` (1 : N):**
  - `document_verification_logs.admin_id` references `users.user_id`.
  - Captures every verification decision (`PENDING` -> `APPROVED` / `REJECTED`), administrative remarks, and timestamp.
  - Provides a tamper-proof audit trail for customer driving licence and vehicle document compliance.

---

## 5. Foreign Key Integrity Verification Checklist

When executing database schema migrations or operational maintenance, verify:

1. **Foreign Key Checks Active:** Ensure `SET FOREIGN_KEY_CHECKS = 1;` is permanently enabled in production.
2. **Cascading Safety:** Verify that high-value business entities (`bookings`, `payments`, `vehicles`) are protected by `RESTRICT` rules against unintended root-level deletion.
3. **Index Coverage:** Ensure all child columns participating in foreign keys have matching single-column or composite prefix indexes to prevent full table locks during parent updates and deletions.

