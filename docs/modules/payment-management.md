# RentIQ — Payment & Dynamic Pricing Engine Technical Documentation

## 1. Overview & Business Domain

The Payment & Dynamic Pricing Engine is the financial core of RentIQ. It executes real-time multi-factor rental fare calculations, locks financial snapshots upon reservation confirmation, manages digital payment transactions across gateways, and handles post-rental reconciliations (excess mileage, fuel deficits, damage assessments, and security deposit refunds).

---

## 2. Multi-Component Pricing Engine Architecture

RentIQ computes rental fares dynamically using a transparent multi-variable mathematical formulation:

$$\text{Total Price} = \Big[ \big( \text{Base Fare} \times M_{\text{category}} \times M_{\text{season}} \big) + \text{Delivery Fee} + \text{Platform Fee} \Big] \times (1 + \text{GST Rate}) + \text{Security Deposit}$$

```
┌────────────────────────────────────────────────────────────────────────┐
│                        RentIQ Pricing Breakdown                       │
├────────────────────────────────┬───────────────────────────────────────┤
│ Base Duration Cost             │ (Days × Daily Rate) + (Hours × Hourly)│
│ Category Multiplier            │ e.g., Sports (1.5×), Luxury (1.4×)    │
│ Seasonal Surge Multiplier      │ Festive / Peak Holiday (1.15× - 1.30×)│
│ Delivery Fee                   │ Doorstep radius calculation (rules)   │
│ Statutory Tax (GST)            │ 18% applied to rental subtotal        │
│ Refundable Security Deposit    │ Categorized escrow holding (e.g. ₹5K) │
└────────────────────────────────┴───────────────────────────────────────┘
```

---

## 3. Financial Snapshot Immutability (`booking_price_breakdown`)

To protect both customers and the business against retroactive price rule mutations, an immutable financial snapshot is recorded in `booking_price_breakdown` at the exact second a reservation is created:

```sql
CREATE TABLE booking_price_breakdown (
  id INT AUTO_INCREMENT PRIMARY KEY,
  booking_id INT NOT NULL UNIQUE,
  base_price DECIMAL(10, 2) NOT NULL,
  hourly_price DECIMAL(10, 2) DEFAULT 0.00,
  duration_days INT NOT NULL,
  duration_hours INT DEFAULT 0,
  seasonal_multiplier DECIMAL(4, 2) DEFAULT 1.00,
  category_multiplier DECIMAL(4, 2) DEFAULT 1.00,
  delivery_fee DECIMAL(10, 2) DEFAULT 0.00,
  insurance_fee DECIMAL(10, 2) DEFAULT 0.00,
  tax_amount DECIMAL(10, 2) NOT NULL,
  discount_amount DECIMAL(10, 2) DEFAULT 0.00,
  security_deposit DECIMAL(10, 2) DEFAULT 0.00,
  total_amount DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (booking_id) REFERENCES bookings(booking_id) ON DELETE CASCADE
);
```

### Invariant:
Even if an administrator subsequently changes the vehicle's `daily_rate` or updates `seasonal_pricing`, historical bookings and invoices remain mathematically stable and verifiable.

---

## 4. Payment Processing & Gateways

```sql
CREATE TABLE payments (
  payment_id INT AUTO_INCREMENT PRIMARY KEY,
  booking_id INT NOT NULL UNIQUE,
  payment_method ENUM('card', 'upi', 'netbanking', 'wallet', 'razorpay', 'stripe') NOT NULL,
  transaction_id VARCHAR(100) NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'INR',
  payment_status ENUM('pending', 'completed', 'failed', 'refunded') DEFAULT 'pending',
  payment_gateway_response JSON NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (booking_id) REFERENCES bookings(booking_id) ON DELETE CASCADE
);
```

- **Supported Channels:** Cards (Visa, Mastercard, RuPay), UPI (PhonePe, Google Pay, Paytm), Netbanking, Razorpay, and Stripe integration.
- **Transactional State Transition:**
  - Upon gateway authorization: `payment_status = 'completed'`, and parent `bookings.status = 'confirmed'`.
  - Upon transaction failure: `payment_status = 'failed'`, booking remains `pending` or transitions to `cancelled` after timeout.

---

## 5. Post-Rental Reconciliation (`booking_additional_charges`)

During vehicle return, the Return Inspection module calculates condition deltas between handover and return:

```sql
CREATE TABLE booking_additional_charges (
  id INT AUTO_INCREMENT PRIMARY KEY,
  booking_id INT NOT NULL,
  charge_type ENUM('excess_km', 'fuel_deficit', 'late_return', 'damage', 'cleaning_fee', 'toll_fine') NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  reason VARCHAR(255) NOT NULL,
  payment_status ENUM('pending', 'paid', 'deducted_from_deposit', 'waived') DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (booking_id) REFERENCES bookings(booking_id) ON DELETE CASCADE,
  INDEX (booking_id)
);
```

### Automated Charge Formulation:
1. **Excess Distance:** $(\text{Return Odometer} - \text{Pickup Odometer} - \text{Allowed Limit}) \times \text{Rate per Excess KM}$ (e.g. ₹15/km).
2. **Fuel Deficit:** If Return Fuel Level is below Pickup Fuel Level: $(\Delta \text{Fuel Liters}) \times \text{Market Fuel Rate} + \text{Refuel Service Fee}$.
3. **Late Return Penalties:** Calculated on an hourly overtime multiplier when the vehicle is returned past the grace period.
4. **Settlement Modes:** Deducted automatically from the held security deposit or billed as an outstanding balance invoice.

