# RentIQ — Vehicle Maintenance & Service Management Module Technical Documentation

## 1. Overview & Business Domain

The Vehicle Maintenance Management Module ensures fleet reliability, customer safety, and asset longevity in RentIQ. It allows fleet managers to schedule preventive maintenance, track active workshop repairs, log expenditures, and monitor interval-based service reminders (by date or odometer threshold).

The module is tightly integrated with the Unified Vehicle Availability Engine to automatically quarantine vehicles undergoing service and prevent booking conflicts.

---

## 2. Maintenance Data Architecture

```sql
CREATE TABLE vehicle_maintenance (
  id INT AUTO_INCREMENT PRIMARY KEY,
  vehicle_id INT NOT NULL,
  maintenance_type ENUM(
    'routine_service', 
    'repair', 
    'inspection', 
    'tire_replacement', 
    'battery_replacement', 
    'oil_change', 
    'other'
  ) NOT NULL,
  description TEXT NULL,
  start_date DATE NOT NULL,
  end_date DATE NULL,
  status ENUM('scheduled', 'in_progress', 'completed', 'cancelled') DEFAULT 'scheduled',
  cost DECIMAL(10, 2) DEFAULT 0.00,
  odometer_at_maintenance INT NULL,
  workshop_name VARCHAR(100) NULL,
  created_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (vehicle_id) REFERENCES vehicles(vehicle_id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE SET NULL,
  INDEX (vehicle_id),
  INDEX (created_by)
);

CREATE TABLE maintenance_reminders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  vehicle_id INT NOT NULL,
  reminder_type ENUM('odometer', 'date', 'both') NOT NULL,
  target_odometer INT NULL,
  target_date DATE NULL,
  description VARCHAR(255) NOT NULL,
  is_triggered TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (vehicle_id) REFERENCES vehicles(vehicle_id) ON DELETE CASCADE,
  INDEX (vehicle_id)
);
```

---

## 3. Maintenance Lifecycle & Fleet Quarantining

```
┌────────────────────────────────────────────────────────┐
│               Schedule Maintenance Ticket              │
│       (Workshop, Type, Date Window, Target ODO)        │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│           Quarantine & Availability Blocking           │
│   • `evaluateVehicleAvailability` detects conflict     │
│   • Vehicle flagged as `unavailable_maintenance`       │
│   • Calendar slots locked from customer reservation    │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│             In-Progress Service & Repairs              │
│      • Technicians perform work at authorized hub      │
│      • Incurred parts and labor costs logged           │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│                 Completion & Release                   │
│   • Status updated to `completed`                      │
│   • Odometer benchmark synchronized                    │
│   • Vehicle returned to active rental inventory        │
└────────────────────────────────────────────────────────┘
```

---

## 4. Automatic Conflict Resolution with Booking Engine

Whenever a customer searches for a vehicle or initiates checkout for dates `[pickupDateTime, returnDateTime]`, the availability helper executes an interval intersection check:

```sql
SELECT id, maintenance_type, start_date, end_date 
FROM vehicle_maintenance
WHERE vehicle_id = ?
  AND status IN ('scheduled', 'in_progress')
  AND NOT (end_date <= ? OR start_date >= ?)
LIMIT 1;
```

If an active or scheduled maintenance ticket overlaps the customer's requested rental period:
1. Availability is set to `availabilityStatus = 'unavailable'`.
2. `bookingEligible` is set to `false`.
3. Customer receives the transparent message:
   *"This vehicle is temporarily unavailable due to scheduled maintenance or servicing during your requested dates."*

---

## 5. Preventive Maintenance & Threshold Reminders

Fleet managers configure predictive maintenance triggers via `maintenance_reminders`:
1. **Odometer Triggers:** e.g., Oil change scheduled at 10,000 km, major overhaul at 50,000 km. Evaluated automatically whenever a return inspection updates the vehicle's current mileage.
2. **Calendar Triggers:** e.g., Annual battery check or seasonal AC servicing. Scanned periodically alongside document compliance checks.
3. **Triggered Actions:** Generates high-priority dashboard alerts for fleet administrators, enabling proactive workshop scheduling before vehicle reliability degrades.

