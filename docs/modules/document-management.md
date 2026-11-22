# RentIQ — Document Management Module Technical Documentation

## 1. Overview & Architecture

The Document Management Module is a core regulatory compliance and risk mitigation engine in RentIQ. It governs the end-to-end lifecycle, verification, archival, and expiry surveillance for two distinct document categories:
1. **Fleet Vehicle Documents:** Regulatory papers required by transport authorities for commercial self-drive vehicle operation (Registration Certificate [RC], Comprehensive Commercial Insurance, Pollution Under Control [PUC], Fitness Certificate, Commercial Permit, and State Road Tax).
2. **Customer Driving Licences:** Customer identification and legal authorization credentials required prior to vehicle release (two-sided driving licence, holder verification, DOB validation, vehicle class endorsement).

The module enforces strict **Zero-Trust Document Verification**: no vehicle can be reserved or dispatched without valid, approved compliance documents, and no customer can complete a booking without an approved, non-expired driving licence.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                               RENTIQ DOCUMENT GOVERNANCE ARCHITECTURE                 │
└────────────────────────────────────────────────────────────────────────────────────────┘
                                            │
           ┌────────────────────────────────┴────────────────────────────────┐
           ▼                                                                 ▼
┌──────────────────────────────┐                          ┌──────────────────────────────────┐
│   Fleet Vehicle Documents    │                          │     Customer Driving Licence     │
├──────────────────────────────┤                          ├──────────────────────────────────┤
│ • RC, Insurance, PUC,        │                          │ • Front & Back High-Res Scans    │
│   Fitness, Permit, Road Tax  │                          │ • DL Number, Holder, Class, DOB  │
│ • Versioned Storage (v1..vN) │                          │ • Versioned History Audit Trail  │
│ • Admin Verify / Reject      │                          │ • 3-Tab Admin Dossier Review     │
└──────────────┬───────────────┘                          └──────────────────┬───────────────┘
               │                                                             │
               └────────────────────────────┬────────────────────────────────┘
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                               Automated Services & Policies                           │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ 1. Immutable Version Archival: `vehicle_document_versions`, `customer_license_history`│
│ 2. Audit Trail Logging: `document_verification_logs` with admin actor and remarks     │
│ 3. Automated Expiry Scanner: In-process background cron with deduplicated alerts       │
│ 4. Unified Booking Gatekeeper: Real-time blocking in `evaluateVehicleAvailability`     │
│ 5. Hardened Document Security: MIME validation, 5MB limit, path traversal defense      │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Vehicle Document Management

### 2.1 Supported Document Types
The system supports six mandatory and operational fleet document types:
- `rc`: Vehicle Registration Certificate (Smart Card / Paper RC).
- `insurance`: Comprehensive Commercial Self-Drive Rental Insurance Policy.
- `puc`: Pollution Under Control Emission Certificate.
- `fitness`: Commercial Vehicle Fitness Certificate issued by the RTO.
- `permit`: State / National All-India Tourist Permit (AITP).
- `road_tax`: Commercial Road Tax Payment Receipt.

### 2.2 Upload & Versioned Renewal Lifecycle
When an administrator uploads a new document or renews an existing document:
1. **Active Record Retention:** The current active document record in `vehicle_documents` is updated in-place with the new details (`document_number`, `issue_date`, `expiry_date`, `file_path`, `version = version + 1`, `verification_status = 'valid'`).
2. **Historical Version Archival:** Prior to updating, the superseded record is cloned into `vehicle_document_versions` with its exact snapshot:
   - `version_number`
   - `document_number`, `issue_date`, `expiry_date`, `file_path`
   - `verification_status`, `admin_remarks`
   - `archived_at = CURRENT_TIMESTAMP`, `archived_by = req.user.user_id`
3. **Audit Log Generation:** A row is inserted into `document_verification_logs` recording the transition, remarks, and acting administrator ID.

### 2.3 Verification & Rejection Workflow
- **Admin Verification (`PATCH /api/admin/documents/:id/verify`):**
  - Sets `verification_status = 'valid'`.
  - Clears any previous `admin_remarks`.
  - Emits verification audit log.
- **Admin Rejection (`PATCH /api/admin/documents/:id/reject`):**
  - Requires mandatory `admin_remarks` explaining the rejection reason (e.g., "Blurry scan", "Name mismatch on insurance policy").
  - Sets `verification_status = 'rejected'`.
  - Emits rejection audit log.
  - Generates an administrative fleet alert and immediately blocks the vehicle from rental eligibility.

---

## 3. Customer Driving Licence Management

### 3.1 Licence Data Model & Dual-Sided Capture
Customers submit their driving licence credentials through their account profile:
- **Attributes:** `license_number`, `holder_name`, `date_of_birth`, `issue_date`, `expiry_date`, `vehicle_class` (`MCWG`, `LMV`, `HMV`).
- **Dual Document Scans:** Two distinct image files must be uploaded:
  - `front_document_path` (Photo, DL Number, Address, Hologram).
  - `back_document_path` (Vehicle Endorsements, Validity Stamps, QR code).

### 3.2 Customer Versioning & Re-Submission Lifecycle
When a customer updates or renews an expired or rejected licence:
1. The existing active record in `customer_licenses` is cloned into `customer_license_history`:
   - Preserves `version_number`, previous front/back paths, previous status, and verification remarks.
2. The active record in `customer_licenses` increments `version = version + 1` and resets `verification_status = 'pending'`.
3. The previous verification log is preserved, and a new audit event is logged.

### 3.3 Admin Review Dossier & Decisioning
Administrators review licences in the dedicated Admin Licences Portal (`/admin/licenses`):
- **3-Tab Modal Interface:**
  1. **Dossier & Inspection:** Side-by-side high-resolution view of front and back licence scans with zoom capabilities, expiry countdown badge, and age verification indicator.
  2. **Version History:** Chronological list of all historical revisions submitted by the customer, with one-click download of historical documents.
  3. **Verification Audit Trail:** Complete tamper-proof timeline of all status changes, admin remarks, and timestamps.
- **Decision Endpoints:**
  - `PATCH /api/admin/licenses/:id/verify`: Approves licence, unlocks customer booking capabilities, and dispatches a success notification.
  - `PATCH /api/admin/licenses/:id/reject`: Requires mandatory reason, marks status as `rejected`, sends actionable notification to customer, and blocks checkout.

---

## 4. Verification History & Audit Trail

All administrative decisions across both vehicle documents and customer licences are recorded in the immutable audit table `document_verification_logs`:

```sql
CREATE TABLE document_verification_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  document_type ENUM('vehicle_document', 'customer_license') NOT NULL,
  document_id INT NOT NULL,
  reference_id VARCHAR(100) NULL,
  previous_status VARCHAR(50) NOT NULL,
  new_status VARCHAR(50) NOT NULL,
  admin_id INT NOT NULL,
  remarks TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (admin_id) REFERENCES users(user_id) ON DELETE CASCADE,
  INDEX idx_doc_verif_doc (document_type, document_id),
  INDEX idx_doc_verif_created (created_at)
);
```

### Key Integrity Invariants:
1. **Append-Only Logging:** No `UPDATE` or `DELETE` endpoints exist for verification logs.
2. **Contextual Traceability:** Every status change stores `previous_status`, `new_status`, `admin_id`, and `remarks`.
3. **UI Integration:** Rendered directly inside modal review drawers for fleet managers and compliance officers.

---

## 5. Expiry Tracking & Automated In-Process Scanner

### 5.1 Dynamic Status Computation
Document expiry status is computed on-the-fly and refreshed dynamically:
$$\text{Status} = \begin{cases}
\text{'expired'} & \text{if } \text{expiry\_date} < \text{CURDATE()} \\
\text{'expiring\_soon'} & \text{if } 0 \le (\text{expiry\_date} - \text{CURDATE()}) \le 30 \text{ days} \\
\text{'valid'} & \text{if } (\text{expiry\_date} - \text{CURDATE()}) > 30 \text{ days}
\end{cases}$$

### 5.2 Background Daemon Architecture (`documentExpiryService.js`)
- **Initialization:** Automatically started on backend boot via `startExpiryScanScheduler()` in `server.js` (initial sweep runs 10 seconds after startup, recurring every 12 hours).
- **Sweep Logic:**
  1. **Vehicle Documents:**
     - Identifies expired documents and updates `verification_status = 'expired'` when current status is `valid`.
     - Checks for alert milestones: `expired`, `expiring_7` ($\le 7$ days), `expiring_15` ($\le 15$ days), and `expiring_30` ($\le 30$ days).
     - **Deduplication Engine:** Queries `notifications` table to verify whether an alert for the specific `vehicle_id`, `document_type`, and milestone was already generated within the past 24 hours. Prevents inbox spamming.
  2. **Customer Driving Licences:**
     - Flags customer licences with `expiry_date < CURDATE()` as `expired`.
     - Generates customer notifications warning of upcoming or past expiry with instructions to renew.
- **Manual Trigger Endpoint:**
  - `POST /api/admin/documents/scan-expiry`: Allows administrators to trigger an immediate fleet-wide compliance sweep on demand.

---

## 6. Booking Eligibility Gatekeeper

The Document Management Module integrates directly into the unified booking availability engine (`backend/utils/vehicleAvailabilityHelper.js`):

```
                        [Customer Initiates Booking]
                                     │
                                     ▼
                ┌──────────────────────────────────────────┐
                │ Does customer have an approved,          │
                │ non-expired driving licence?             │
                └────────────────────┬─────────────────────┘
                                     │
                     ┌───────────────┴───────────────┐
                     ▼ YES                           ▼ NO
        ┌─────────────────────────┐     ┌───────────────────────────────────┐
        │ Are all mandatory fleet │     │ Block Booking:                    │
        │ vehicle documents valid │     │ 'CUSTOMER_LICENSE_REQUIRED' /     │
        │ and unexpired?          │     │ 'CUSTOMER_LICENSE_EXPIRED'        │
        └────────────┬────────────┘     └───────────────────────────────────┘
                     │
         ┌───────────┴───────────┐
         ▼ YES                   ▼ NO
┌──────────────────┐    ┌───────────────────────────────────┐
│ Permit Booking   │    │ Block Booking:                    │
│ Reservation      │    │ 'VEHICLE_DOCUMENTS_INVALID'       │
└──────────────────┘    └───────────────────────────────────┘
```

1. **Mandatory Fleet Documents:** A vehicle must have active, approved records for `RC`, `Insurance`, and `PUC` with `expiry_date >= reservation_end_date`. If any required document is expired, missing, or rejected, `evaluateVehicleAvailability()` returns `bookingEligible: false`.
2. **Customer Licence Gate:** The customer's licence must have `verification_status = 'approved'` and `expiry_date >= reservation_end_date`.

---

## 7. Storage Architecture & Document Security

### 7.1 Hardened File Upload Controls
File ingestion is governed by Multer storage engines with defense-in-depth controls:
- **Maximum File Size:** Strictly capped at `5MB` (5,242,880 bytes).
- **Allowed Extensions:** `.pdf`, `.jpg`, `.jpeg`, `.png`, `.webp`.
- **MIME Type Validation:** `application/pdf`, `image/jpeg`, `image/png`, `image/webp`. Binary executables, scripts, and HTML files are rejected with `400 Bad Request`.
- **Nonce Filename Generation:** Uploaded files are renamed using UUID v4 tokens (`crypto.randomUUID()`) to prevent filename collisions and guessing attacks.

### 7.2 Directory Segregation
Files are stored outside public web roots:
- Fleet Vehicle Documents: `backend/uploads/vehicle_documents/`
- Customer Driving Licences: `backend/uploads/customer_licenses/`

### 7.3 Path Traversal Defense & Access Control
- **Download Streams:** Handled via dedicated Express endpoints (`res.sendFile()`) rather than static file serving.
- **Sanitization:** All filename requests pass through `path.basename()` to strip `../`, null bytes, and traversal vectors.
- **Authorization Enforcement:**
  - Admin endpoints require JWT with `role === 'admin'`.
  - Customer download endpoints verify that `req.user.user_id` matches the document owner (`license.user_id === req.user.user_id`).

