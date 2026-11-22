# RentIQ — Vehicle Inspection Management Module Technical Documentation

## 1. Overview & Business Domain

The Vehicle Inspection Management Module establishes accountability and legal transparency during vehicle handovers in RentIQ. It provides a standardized digital check-in and check-out framework that eliminates disputes regarding pre-existing vehicle damages, fuel levels, and mileage.

The module operates across two key operational phases for every booking:
1. **Pickup Inspection (Check-Out):** Executed when the vehicle is released to the customer. Records baseline odometer reading, fuel percentage, exterior condition, interior cleanliness, and photographic proof.
2. **Return Inspection (Check-In):** Executed when the customer returns the vehicle. Computes mileage deltas, fuel consumption, new damages, and generates automated reconciliation charges.

---

## 2. Inspection Data Architecture

```sql
CREATE TABLE vehicle_inspections (
  id INT AUTO_INCREMENT PRIMARY KEY,
  booking_id INT NOT NULL,
  vehicle_id INT NOT NULL,
  inspected_by INT NOT NULL,
  inspection_type ENUM('pickup', 'return') NOT NULL,
  odometer_reading INT NOT NULL,
  fuel_level INT NOT NULL,
  exterior_condition ENUM('clean', 'minor_scratches', 'dented', 'damaged') DEFAULT 'clean',
  interior_condition ENUM('clean', 'stained', 'damaged') DEFAULT 'clean',
  has_damage TINYINT(1) DEFAULT 0,
  damage_notes TEXT NULL,
  signature_url VARCHAR(255) NULL,
  inspected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (booking_id) REFERENCES bookings(booking_id) ON DELETE CASCADE,
  FOREIGN KEY (vehicle_id) REFERENCES vehicles(vehicle_id) ON DELETE CASCADE,
  FOREIGN KEY (inspected_by) REFERENCES users(user_id) ON DELETE RESTRICT,
  UNIQUE KEY unique_booking_inspection_type (booking_id, inspection_type),
  INDEX (vehicle_id),
  INDEX (inspected_by)
);

CREATE TABLE inspection_photos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  inspection_id INT NOT NULL,
  photo_url VARCHAR(255) NOT NULL,
  photo_type ENUM('odometer', 'fuel_gauge', 'front', 'rear', 'left_side', 'right_side', 'interior', 'damage') NOT NULL,
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (inspection_id) REFERENCES vehicle_inspections(id) ON DELETE CASCADE,
  INDEX (inspection_id)
);
```

### Relational Invariant:
The composite unique constraint `unique_booking_inspection_type (booking_id, inspection_type)` guarantees that a booking can have at most one official pickup record and one official return record.

---

## 3. Handover & Return Operational Workflow

```
       [Booking Confirmed]
               │
               ▼
┌──────────────────────────────┐
│      Pickup Inspection       │
├──────────────────────────────┤
│ • Inspector records Odometer │
│ • Fuel % (0 - 100%)          │
│ • 360° Body Photos & Interior│
│ • Customer Digital Signature │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│  Booking Status -> 'ACTIVE'  │
└──────────────┬───────────────┘
               │
               ▼ (Rental Period)
┌──────────────────────────────┐
│      Return Inspection       │
├──────────────────────────────┤
│ • Final Odometer & Fuel %    │
│ • Photographic Condition Log │
│ • Damage Identification      │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│    Condition Delta Engine    │
├──────────────────────────────┤
│ • Distance = Return - Pickup │
│ • Fuel Delta = Return - Base │
│ • Additional Charges Incurred│
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│ Booking Status -> 'COMPLETED'│
└──────────────────────────────┘
```

---

## 4. Condition Delta Engine & Automated Post-Rental Charges

When a return inspection is submitted, the system compares the return record against the baseline pickup inspection:

1. **Mileage Delta:**
   $$\Delta \text{Distance} = \text{Return Odometer} - \text{Pickup Odometer}$$
   - If $\Delta \text{Distance} > \text{Allowed Mileage Allowance}$, the excess kilometers are multiplied by the rule rate (e.g. ₹15/km) and inserted into `booking_additional_charges` with `charge_type = 'excess_km'`.
2. **Fuel Deficit Delta:**
   $$\Delta \text{Fuel} = \text{Pickup Fuel Level} - \text{Return Fuel Level}$$
   - If $\Delta \text{Fuel} > 0$, the missing liters are computed based on the vehicle tank capacity and billed with `charge_type = 'fuel_deficit'`.
3. **Damage Assessment:**
   - If `has_damage = 1` on return but was `0` or absent on pickup, the inspector logs damage notes and captures damage photos, generating an initial damage assessment ticket for administrative review.

---

## 5. Admin Bookings Portal Integration

The Inspection workflow is fully integrated into the Admin Bookings interface (`/admin/bookings`):
- **Clickable Inspection Action:** The "Inspection" button triggers `handleOpenInspection(booking)` passing `booking.booking_id` and `booking.vehicle_id`.
- **Pre-fill & Multi-View State:**
  - If no pickup inspection exists: Opens the **Pickup Handover Form**.
  - If pickup exists but return is pending: Displays the **Return Check-in Form** pre-populated with baseline pickup readings and photographic benchmarks.
  - If both exist: Renders the **Comparative Inspection Diff Report** highlighting kilometers driven, fuel difference, and side-by-side photo inspection cards.

