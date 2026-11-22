# RentIQ — Digital Rental Agreements Module Technical Documentation

## 1. Overview & Business Domain

The Digital Rental Agreements Module provides legally binding, paperless contract governance for every vehicle rental in RentIQ. It automates contract generation from reservation parameters, captures mutual electronic signatures, generates immutable PDF legal instruments, and enforces cryptographic verification to eliminate post-execution contract tampering.

---

## 2. Agreement Data Architecture

```sql
CREATE TABLE rental_agreements (
  id INT AUTO_INCREMENT PRIMARY KEY,
  booking_id INT NOT NULL,
  user_id INT NOT NULL,
  agreement_number VARCHAR(50) NOT NULL UNIQUE,
  agreement_version INT DEFAULT 1,
  status ENUM(
    'draft', 
    'generated', 
    'signed_by_customer', 
    'countersigned', 
    'active', 
    'terminated'
  ) DEFAULT 'draft',
  terms_snapshot JSON NOT NULL,
  customer_signature_url VARCHAR(255) NULL,
  customer_signed_at TIMESTAMP NULL,
  admin_signature_url VARCHAR(255) NULL,
  admin_signed_at TIMESTAMP NULL,
  pdf_path VARCHAR(255) NULL,
  pdf_hash_sha256 VARCHAR(64) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (booking_id) REFERENCES bookings(booking_id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
  UNIQUE KEY unique_booking_agreement (booking_id, agreement_version),
  INDEX (user_id)
);
```

### Relational Invariants:
1. `agreement_number` is globally unique across the fleet (formatted as `RIQ-AGR-{booking_id}-{random_nonce}`).
2. `unique_booking_agreement (booking_id, agreement_version)` enables versioned contract amendments while maintaining a strict 1-to-1 mapping for any given contract revision.

---

## 3. Contract Lifecycle & Mutual Signature Workflow

```
       [Booking Confirmed & Paid]
                   │
                   ▼
┌──────────────────────────────────────┐
│       1. Contract Generation         │
├──────────────────────────────────────┤
│ • Populates legal clauses            │
│ • Injects financial snapshot         │
│ • Formats vehicle compliance clauses │
│ • Status: 'GENERATED'                │
└──────────────────┬───────────────────┘
                   │
                   ▼
┌──────────────────────────────────────┐
│       2. Customer Signature          │
├──────────────────────────────────────┤
│ • Customer reviews terms in portal   │
│ • Affixes digital signature canvas   │
│ • Records IP & timestamp             │
│ • Status: 'SIGNED_BY_CUSTOMER'       │
└──────────────────┬───────────────────┘
                   │
                   ▼
┌──────────────────────────────────────┐
│       3. Fleet Handover &            │
│          Admin Countersignature      │
├──────────────────────────────────────┤
│ • Fleet manager executes handover    │
│ • Affixes administrative signature   │
│ • Status: 'COUNTERSIGNED' / 'ACTIVE' │
└──────────────────┬───────────────────┘
                   │
                   ▼
┌──────────────────────────────────────┐
│    4. PDF Generation & SHA-256 Lock  │
├──────────────────────────────────────┤
│ • Compiles final PDF document        │
│ • Computes SHA-256 cryptographic hash│
│ • Stores immutable PDF on disk       │
└──────────────────────────────────────┘
```

---

## 4. Contract Snapshot & Legal Terms (`terms_snapshot`)

Rather than relying on mutable relational tables, all contract conditions are locked as a JSON document inside `terms_snapshot` at the time of agreement generation:
- **Parties:** Customer full name, verified licence number, contact address, corporate entity details.
- **Asset Specifications:** Vehicle make, model, year, VIN/chassis, registration number, starting odometer.
- **Financial Terms:** Daily rate, security deposit held, allowed kilometer quota, excess km rate, fuel deficit penalties.
- **Statutory Terms:** Self-drive operational limits, inter-state permit compliance, banned usage (racing, sub-leasing, illegal transport), insurance deductible limits, and dispute jurisdiction.

---

## 5. Cryptographic Verification & PDF Integrity (`pdf_hash_sha256`)

To ensure evidentiary compliance under digital signature transport regulations:
1. **Compilation:** Upon mutual countersignature, the agreement is compiled into a standalone PDF document located at `backend/uploads/agreements/RIQ-AGR-{id}.pdf`.
2. **Cryptographic Hashing:** The backend computes a SHA-256 digest of the raw PDF binary:
   ```javascript
   const crypto = require('crypto');
   const fs = require('fs');
   
   const fileBuffer = fs.readFileSync(pdfFilePath);
   const hashSum = crypto.createHash('sha256');
   hashSum.update(fileBuffer);
   const hexHash = hashSum.digest('hex');
   ```
3. **Immutability Enforcement:** The computed digest is written to `rental_agreements.pdf_hash_sha256`. Any subsequent off-band modification to the PDF file on disk would produce a mismatched checksum during download verification, alerting administrators to file tampering.

