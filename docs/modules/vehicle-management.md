# RentIQ — Vehicle Management Module Technical Documentation

## 1. Overview & Business Domain

The Vehicle Management Module is the operational core of RentIQ. It manages the complete fleet asset lifecycle: catalog management, category taxonomy, vehicle specifications, real-time availability evaluation, and administrative fleet operations.

The module provides high-performance vehicle browsing for customers while giving fleet managers granular control over inventory status, pricing configurations, and vehicle compliance.

---

## 2. Fleet Taxonomy & Category Architecture

RentIQ categorizes fleet assets into standardized vehicle categories, each associated with distinct pricing multipliers and operational characteristics:

```
┌─────────────────────────────────────────────────────────────┐
│                      Vehicle Categories                     │
├────────────┬─────────────┬───────────┬──────────────────────┤
│ Category   │ Seats       │ Premium   │ Typical Fleet Assets │
├────────────┼─────────────┼───────────┼──────────────────────┤
│ SUV        │ 5 - 7 Seats │ Standard  │ Scorpio, XUV700, Fortuner
│ Sedan      │ 5 Seats     │ Standard  │ City, Verna, Ciaz    │
│ Hatchback  │ 4 - 5 Seats │ Economy   │ Swift, i20, Baleno   │
│ Luxury     │ 4 - 5 Seats │ High      │ BMW 5 Series, E-Class│
│ Sports     │ 2 - 4 Seats │ Ultra     │ Mustang, Porsche 718 │
│ Electric   │ 5 Seats     │ Eco       │ Nexon EV, Ioniq 5    │
└────────────┴─────────────┴───────────┴──────────────────────┘
```

- **Database Table:** `categories` (`category_id`, `name`, `description`, `base_price_multiplier`, `image_url`).
- **Referential Protection:** `vehicles.category_id` references `categories.category_id` with `ON DELETE RESTRICT` to prevent accidental orphaned inventory.

---

## 3. Vehicle Specification & Schema

The `vehicles` table defines physical, operational, and financial parameters for every fleet asset:

```sql
CREATE TABLE vehicles (
  vehicle_id INT AUTO_INCREMENT PRIMARY KEY,
  make VARCHAR(50) NOT NULL,
  model VARCHAR(50) NOT NULL,
  year INT NOT NULL,
  registration_number VARCHAR(20) NOT NULL UNIQUE,
  category_id INT NOT NULL,
  daily_rate DECIMAL(10, 2) NOT NULL,
  hourly_rate DECIMAL(10, 2) NULL,
  seating_capacity INT NOT NULL,
  transmission ENUM('manual', 'automatic') NOT NULL,
  fuel_type ENUM('petrol', 'diesel', 'electric', 'hybrid') NOT NULL,
  mileage DECIMAL(8, 2) NULL,
  image_url VARCHAR(255) NULL,
  is_available TINYINT(1) DEFAULT 1,
  status ENUM('available', 'rented', 'maintenance', 'reserved', 'retired') DEFAULT 'available',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES categories(category_id) ON DELETE RESTRICT,
  INDEX idx_vehicles_registration_number (registration_number),
  INDEX idx_vehicles_category (category_id),
  INDEX idx_vehicles_available (is_available)
);
```

---

## 4. Unified Vehicle Availability Engine

### 4.1 Single Source of Truth
RentIQ resolves availability discrepancies across customer catalog, checkout, and admin pages by channeling all evaluations through a single backend engine: `backend/utils/vehicleAvailabilityHelper.js` -> `evaluateVehicleAvailability(vehicleId, pickupDateTime, returnDateTime, conn)`.

### 4.2 Comprehensive 4-Pillar Evaluation Logic
To be certified as `available` and `bookingEligible: true`, a vehicle must pass all four validation pillars:

```
                    [evaluateVehicleAvailability()]
                                  │
       ┌──────────────────────────┼──────────────────────────┬────────────────────────┐
       ▼                          ▼                          ▼                        ▼
┌──────────────┐           ┌──────────────┐           ┌──────────────┐         ┌──────────────┐
│  Pillar 1:   │           │  Pillar 2:   │           │  Pillar 3:   │         │  Pillar 4:   │
│ Master Flag  │           │ Maintenance  │           │  Document    │         │ Overlapping  │
│  & Status    │           │ Conflicts    │           │  Compliance  │         │ Bookings     │
└──────────────┘           └──────────────┘           └──────────────┘         └──────────────┘
```

1. **Pillar 1: Master Administrative Flag & Operational Status:**
   - Must satisfy `is_available = 1` and `status = 'available'`.
   - If `status = 'maintenance'` or `is_available = 0`, evaluation terminates with `unavailable_maintenance` or `deactivated`.
2. **Pillar 2: Active Maintenance Conflicts:**
   - Queries `vehicle_maintenance` table for records where `status IN ('scheduled', 'in_progress')`.
   - If dates are supplied, checks temporal overlap:
     $$\neg (\text{m.end\_date} \le \text{pickup} \lor \text{m.start\_date} \ge \text{return})$$
3. **Pillar 3: Regulatory Document Compliance:**
   - Queries `vehicle_documents` for mandatory types: `rc`, `insurance`, `puc`.
   - All documents must have `verification_status = 'valid'`.
   - Must not be expired: `expiry_date >= return_datetime` (or $\ge \text{CURDATE()}$ if dates omitted).
   - If any document is missing or expired, availability terminates with `unavailable_compliance`.
4. **Pillar 4: Overlapping Reservations:**
   - Queries `bookings` for reservations where `status IN ('pending', 'confirmed', 'active')`.
   - Uses the composite index `idx_bookings_vehicle_datetime`:
     $$\neg (\text{b.return\_datetime} \le \text{pickup} \lor \text{b.pickup\_datetime} \ge \text{return})$$
   - If conflict detected, returns `booked`.

### 4.3 Standardized Evaluation Response
```json
{
  "vehicleId": 6,
  "availabilityStatus": "available",
  "bookingEligible": true,
  "reason": "Vehicle is ready and certified for rental.",
  "flags": {
    "isAvailable": true,
    "hasMaintenanceConflict": false,
    "hasDocumentIssue": false,
    "hasBookingConflict": false
  },
  "documents": {
    "compliant": true,
    "missing": [],
    "expired": []
  }
}
```

---

## 5. Administrative Fleet Workflows

### 5.1 Add Vehicle Workflow
- **Form Submission:** Admin submits make, model, year, registration number, category, daily rate, seating capacity, transmission, fuel type, and vehicle image.
- **Form Persistence & Validation:** If backend rejects due to duplicate registration number, the form preserves entered values and highlights error.
- **Success Handling:** Upon successful creation, the UI displays a success toast, closes the modal/form automatically, and reloads the inventory table.

### 5.2 Edit & Status Override
- Allows updating rental rates, mileage, image, and operational status (`available`, `maintenance`, `retired`).
- Real-time badges in the admin table reflect the unified availability evaluation alongside document compliance status pills (`0 Docs`, `Valid`, `Expired`).

---

## 6. Customer Catalog & Discovery

- **Filter Pipeline:** Category filtering (`SUV`, `Sedan`, `Hatchback`, `Luxury`, `Sports`, `Electric`), transmission (`Automatic`, `Manual`), fuel type, seating capacity, and price range.
- **Search Capabilities:** Text search across make and model.
- **Dynamic Pricing Indicators:** Displays base daily rate, hourly rate, and seasonal/weekend tags.

