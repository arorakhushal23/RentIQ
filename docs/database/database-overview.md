# RentIQ Database Architecture & Overview

## 1. Executive Summary

RentIQ utilizes a relational database architecture powered by **MySQL 8.0+** running the ACID-compliant **InnoDB** storage engine. The database is designed to serve as the single source of truth for an enterprise-grade vehicle rental platform, supporting:

- Multi-category fleet operations (Hatchbacks, Sedans, SUVs, Sports, EVs, Motorcycles, Scooters)
- Hourly and multi-day reservation scheduling with pessimistic row-locking serialization
- Regulatory compliance management (vehicle registration, insurance, PUC, fitness, commercial permits)
- Customer driving licence verification, entitlement checking (LMV vs MCWG), and versioned audit history
- Authoritative dynamic pricing engine with duration discounts, weekend surcharges, seasonal multipliers, and doorstep delivery fees
- Digital handover inspections with photo attachments and difference delta analysis
- Scheduled and odometer-based maintenance management with automatic booking conflict prevention
- Legally binding digital rental agreements with immutable financial snapshots and acceptance tracking

---

## 2. Technical Environment & Specifications

| Parameter | Specification | Details / Configuration |
| :--- | :--- | :--- |
| **RDBMS Engine** | MySQL 8.0+ | InnoDB Default Storage Engine |
| **Character Set** | `utf8mb4` | Full multilingual, emoji, and symbol support |
| **Collation** | `utf8mb4_unicode_ci` | Case-insensitive unicode collation |
| **Connection Layer** | Node.js `mysql2/promise` | Connection pooling with parameterized queries |
| **Pool Sizing** | Default: 10 connections | Configured in `backend/config/db.js` |
| **Timezone Storage** | UTC / `CURRENT_TIMESTAMP` | Stored in ISO / SQL standard format |
| **Total Tables** | **27 Tables** | Modular schema grouped into 7 operational domains |
| **Total Foreign Keys** | **29 Foreign Keys** | Enforced referential integrity with cascading where appropriate |

---

## 3. Database Domain Decomposition

The 27 database tables are logically organized into 7 business domains:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        RENTIQ DATABASE SCHEMA                          │
├─────────────────┬──────────────────┬─────────────────┬─────────────────┤
│ 1. Identity &   │ 2. Fleet &       │ 3. Compliance & │ 4. Booking &    │
│    Access       │    Catalog       │    Verification │    Reservations │
├─────────────────┼──────────────────┼─────────────────┼─────────────────┤
│ • users         │ • categories     │ • vehicle_docs  │ • bookings      │
│ • password_res. │ • vehicles       │ • veh_doc_vers. │ • booking_price │
│ • notifications │ • service_hubs   │ • cust_licenses │ • booking_addl. │
│ • contact_msgs  │ • wishlist       │ • cust_lic_hist │ • payments      │
│                 │ • reviews        │ • doc_verif_log │ • rent_agree.   │
├─────────────────┴──────────────────┼─────────────────┴─────────────────┤
│ 5. Inspection & Condition          │ 6. Pricing & Revenue Management   │
├────────────────────────────────────┼───────────────────────────────────┤
│ • vehicle_inspections              │ • pricing_rules                   │
│ • inspection_photos                │ • delivery_pricing_rules          │
├────────────────────────────────────┼ • seasonal_pricing                │
│ 7. Maintenance & Compliance Alerts │ • additional_charge_rules         │
├────────────────────────────────────┴───────────────────────────────────┤
│ • vehicle_maintenance                                                  │
│ • maintenance_reminders                                                │
└────────────────────────────────────────────────────────────────────────┘
```

### Domain 1: Identity, Authentication & Communication
- `users`: Central credentials, role-based access control (`customer`, `admin`), profile data.
- `password_reset_tokens`: Cryptographically random hex tokens, expiry timestamps, usage tracking.
- `notifications`: User-directed system alerts, document expiry milestones, licence status updates.
- `contact_messages`: Public contact inquiries, administrative reply records.

### Domain 2: Fleet Catalog & Asset Management
- `categories`: High-level vehicle classification (Sedan, SUV, Sports, Hatchback, Bike, Scooter, EV).
- `vehicles`: Full physical, technical, registration, and operational specifications.
- `service_hubs`: Operational physical hub locations with latitude/longitude coordinates.
- `wishlist`: Customer vehicle bookmarks for rapid re-engagement.
- `reviews`: Customer vehicle ratings (1 to 5 stars) with textual feedback.

### Domain 3: Regulatory Compliance & Document Verification
- `vehicle_documents`: Active compliance certificates (RC, Insurance, PUC, Fitness, Permit, Road Tax).
- `vehicle_document_versions`: Historical archive of renewed/superseded vehicle documents.
- `customer_licenses`: Active customer driving licences, status (`pending`, `verified`, `rejected`, `expired`), class entitlements.
- `customer_license_history`: Historical archive of customer licence resubmissions and renewals.
- `document_verification_logs`: Immutable administrative audit trail for all approval and rejection actions.

### Domain 4: Bookings & Financial Checkout
- `bookings`: Core reservation records, start/end datetimes, status machine, delivery coordinates.
- `booking_price_breakdown`: Immutable breakdown snapshots (base rent, weekend surcharge, duration discounts, delivery).
- `booking_additional_charges`: Post-rental charges (late returns, excess mileage, fuel deficits, damages).
- `payments`: Financial transaction records, payment methods, transaction references, payment statuses.
- `rental_agreements`: Legally binding digital rental agreements, PDF storage, mutual digital signatures.

### Domain 5: Handover Inspections & Evidence
- `vehicle_inspections`: Pickup and return inspection checklists, odometer readings, fuel percentages, damage notes.
- `inspection_photos`: Categorized evidence photos (front, rear, left, right, interior, dashboard, damage).

### Domain 6: Dynamic Pricing & Distance Rules
- `pricing_rules`: Global duration discounts, peak surcharges, weekend multipliers, security deposit rules.
- `delivery_pricing_rules`: Tiered doorstep delivery fees (base fare, per-km rates, maximum radius).
- `seasonal_pricing`: Date-bound holiday, seasonal, and festive demand multipliers.
- `additional_charge_rules`: Standardized fee matrix for hourly late returns, excess km, and fuel replenishment.

### Domain 7: Fleet Maintenance & Servicing
- `vehicle_maintenance`: Scheduled and corrective maintenance workshop records, costs, service centers.
- `maintenance_reminders`: Automated due-date and due-odometer service alerts.

---

## 4. Design Principles & Conventions

1. **Surrogate Primary Keys:** Every entity utilizes an unsigned, auto-incrementing integer (`id` or `{entity}_id`) as its primary key.
2. **Explicit Foreign Key Constraints:** All parent-child relationships enforce referential integrity using standard InnoDB constraints with `ON DELETE CASCADE` or `ON DELETE SET NULL`.
3. **Immutable Financial Snapshots:** Checkout price breakdowns and rental agreements store calculated amounts at the moment of booking confirmation, shielding historical financial records from future pricing rule updates.
4. **Unified Single Source of Truth:** Vehicle availability and booking eligibility use centralized database queries that simultaneously verify operational availability, document validity, active maintenance blocks, and booking conflicts.
5. **Auditability & Traceability:** All administrative approvals, rejections, and renewals write immutable log entries into `document_verification_logs`.

