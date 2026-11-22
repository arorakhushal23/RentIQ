# RentIQ — Booking Management Module Technical Documentation

## 1. Overview & Business Domain

The Booking Management Module coordinates the reservation lifecycle in RentIQ. It connects customer demand with fleet asset availability, orchestrates price calculation, enforces concurrency locking against double bookings, executes strict identity and vehicle compliance checks, and coordinates post-booking handovers.

---

## 2. Booking Data Architecture

```sql
CREATE TABLE bookings (
  booking_id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  vehicle_id INT NOT NULL,
  pickup_datetime DATETIME NOT NULL,
  return_datetime DATETIME NOT NULL,
  pickup_location VARCHAR(255) NOT NULL,
  drop_location VARCHAR(255) NOT NULL,
  delivery_type ENUM('hub_pickup', 'doorstep_delivery') DEFAULT 'hub_pickup',
  total_price DECIMAL(10, 2) NOT NULL,
  security_deposit DECIMAL(10, 2) DEFAULT 0.00,
  status ENUM('pending', 'confirmed', 'active', 'completed', 'cancelled') DEFAULT 'pending',
  cancellation_reason VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
  FOREIGN KEY (vehicle_id) REFERENCES vehicles(vehicle_id) ON DELETE RESTRICT,
  INDEX idx_bookings_user (user_id),
  INDEX idx_bookings_vehicle_datetime (vehicle_id, pickup_datetime, return_datetime)
);
```

---

## 3. Booking Lifecycle & State Transitions

The booking lifecycle progresses through five strict states:

```
                    [Customer Submits Reservation]
                                  │
                                  ▼
                            ┌───────────┐
            ┌───────────────┤  PENDING  ├───────────────┐
            │               └─────┬─────┘               │
            │ (Payment            │ (Payment            │ (Timeout / User
            │  Failed)            ▼  Succeeded)         │  Abandons)
            │               ┌───────────┐               │
            │               │ CONFIRMED │               │
            │               └─────┬─────┘               │
            │                     │ (Pickup Inspection  │
            │                     ▼  Completed)         │
            │               ┌───────────┐               │
            │               │  ACTIVE   │               │
            │               └─────┬─────┘               │
            │                     │ (Return Inspection  │
            │                     ▼  & Reconciliation)  │
            │               ┌───────────┐               │
            │               │ COMPLETED │               │
            │               └───────────┘               │
            ▼                                           ▼
      ┌───────────┐                               ┌───────────┐
      │ CANCELLED │◄──────────────────────────────┤ CANCELLED │
      └───────────┘    (Admin / User Cancellation)└───────────┘
```

1. **`pending`:** Reservation created; awaiting payment confirmation or identity verification sign-off.
2. **`confirmed`:** Payment authorized; vehicle locked in calendar; rental agreement dispatched for digital signature.
3. **`active`:** Vehicle released to customer following successful digital pickup inspection and agreement countersigning.
4. **`completed`:** Vehicle returned to hub; digital return inspection executed; odometer/fuel delta calculated; additional charges settled.
5. **`cancelled`:** Reservation terminated prior to handover. Cancellation reason recorded; payment refund processed according to policy.

---

## 4. Concurrency Protection & Overlap Prevention

To guarantee that two customers cannot book the same vehicle for overlapping time slots under high concurrency:

1. **Transaction Isolation:** The booking creation controller initiates a dedicated database transaction (`conn.beginTransaction()`).
2. **Pessimistic Locking (`SELECT ... FOR UPDATE`):**
   ```sql
   SELECT vehicle_id, is_available, status 
   FROM vehicles 
   WHERE vehicle_id = ? 
   FOR UPDATE;
   ```
   This locks the target vehicle row, preventing concurrent transactions from evaluating availability until the active transaction completes.
3. **Composite Temporal Overlap Evaluation:**
   ```sql
   SELECT booking_id 
   FROM bookings
   WHERE vehicle_id = ?
     AND status IN ('pending', 'confirmed', 'active')
     AND NOT (return_datetime <= ? OR pickup_datetime >= ?)
   FOR UPDATE;
   ```
4. **Atomic Commitment:** If no overlapping reservations exist, the booking and itemized pricing snapshot are inserted atomically, and `conn.commit()` releases the lock.

---

## 5. Pre-Booking Gatekeeping & Validation

Before the booking transaction proceeds, the backend executes three strict prerequisite checks:

1. **Identity & Licence Validation:**
   - Evaluates `customer_licenses` for `req.user.user_id`.
   - Must have `verification_status = 'approved'`.
   - Must satisfy `expiry_date >= return_datetime`.
   - If missing or unapproved, responds with `400 Bad Request` (`CUSTOMER_LICENSE_REQUIRED`).
2. **Fleet Compliance Validation:**
   - Evaluates `evaluateVehicleAvailability(vehicleId, pickupDateTime, returnDateTime, conn)`.
   - If compliance documents (`RC`, `Insurance`, `PUC`) are missing or expired, reservation is blocked (`VEHICLE_DOCUMENTS_INVALID`).
3. **Maintenance Conflict Check:**
   - Verifies no active maintenance tickets overlap the rental window.

---

## 6. Location & Delivery Modes

RentIQ supports two pickup models configured via the customer booking flow:
1. **Hub Pickup (`hub_pickup`):** Customer arrives at a designated service hub (e.g., Downtown Central, Airport Terminal 3). Hub selection draws from the `service_hubs` directory.
2. **Doorstep Delivery (`doorstep_delivery`):**
   - Customer enters their delivery address.
   - Integrated OpenStreetMap / Leaflet interface allows searching locations (e.g., "Patiala", "Connaught Place") with explicit `event.preventDefault()` and `type="button"` search handlers to prevent form refresh.
   - Calculates delivery distance and computes delivery pricing via `delivery_pricing_rules`.

