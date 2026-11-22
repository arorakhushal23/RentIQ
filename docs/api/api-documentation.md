# RentIQ — RESTful API Specification & Reference Manual

## 1. API Architecture & Standards

The RentIQ Backend API is structured around REST principles, delivering JSON payloads with standard HTTP status codes. All endpoints operate over HTTPS in production.

### 1.1 Base URL & Mounting
- Development Base URL: `http://localhost:5000/api`
- Content Type: `application/json` (except multipart/form-data for uploads)

### 1.2 Authentication & Authorization Headers
Protected endpoints require an `Authorization` header containing a valid JSON Web Token (JWT):
```http
Authorization: Bearer <jwt_access_token>
```
- **Public:** No authentication required.
- **Customer:** Valid JWT token issued upon customer login (`role === 'customer'` or `'admin'`).
- **Admin:** Valid JWT token with administrative privileges (`role === 'admin'`).

### 1.3 Standard Error Responses
```json
{
  "success": false,
  "message": "Human-readable explanation of error.",
  "code": "MACHINE_READABLE_ERROR_CODE",
  "errors": []
}
```

---

## 2. Authentication & Identity Management (`/api/auth`)

| Method | Endpoint | Access | Description |
|--------|----------|:------:|-------------|
| `POST` | `/api/auth/register` | Public | Register customer account (`first_name`, `last_name`, `email`, `password`, `phone`). |
| `POST` | `/api/auth/login` | Public | Authenticate user credentials and receive JWT access token. |
| `GET` | `/api/auth/me` | Customer | Fetch profile details of currently authenticated user. |
| `PUT` | `/api/auth/me` | Customer | Update profile information (`first_name`, `last_name`, `phone`). |
| `PUT` | `/api/auth/change-password` | Customer | Update password (`current_password`, `new_password`). |
| `POST` | `/api/auth/forgot-password` | Public | Request password reset email containing secure reset token. |
| `POST` | `/api/auth/reset-password` | Public | Submit new password with valid `token`. |
| `GET` | `/api/auth/dev-last-reset-token` | Public | Development helper to retrieve most recent reset token. |

---

## 3. Vehicle Catalog & Public Fleet (`/api/vehicles`)

| Method | Endpoint | Access | Description |
|--------|----------|:------:|-------------|
| `GET` | `/api/vehicles/categories` | Public | List all active vehicle categories with multipliers and metadata. |
| `GET` | `/api/vehicles` | Public | Browse fleet catalog with search, category filter, price, transmission, and seat filters. |
| `GET` | `/api/vehicles/:id` | Public | Retrieve vehicle specifications, category data, and verified compliance status. |

---

## 4. Customer Driving Licences (`/api/licenses`)

| Method | Endpoint | Access | Description |
|--------|----------|:------:|-------------|
| `GET` | `/api/licenses/my-license` | Customer | Retrieve the customer's current active driving licence record. |
| `POST` | `/api/licenses/submit` | Customer | Upload/renew dual-sided licence scans (`front`, `back`) and metadata (`multipart/form-data`). |
| `GET` | `/api/licenses/my-license/document/:side` | Customer | Securely download or preview customer's own active licence scan (`front` or `back`). |
| `GET` | `/api/licenses/my-license/history` | Customer | Retrieve chronological list of past licence revisions and renewals. |
| `GET` | `/api/licenses/my-license/history/:historyId/document/:side` | Customer | Download historical document image from past submission. |

---

## 5. Reservations & Booking Management (`/api/bookings`)

| Method | Endpoint | Access | Description |
|--------|----------|:------:|-------------|
| `GET` / `POST` | `/api/bookings/check-availability` | Public | Evaluate vehicle availability for given `vehicle_id`, `pickup_datetime`, and `return_datetime`. |
| `POST` | `/api/bookings` | Customer | Create reservation with strict concurrency lock, licence check, and itemized pricing snapshot. |
| `GET` | `/api/bookings/my-bookings` | Customer | List all past, active, and upcoming reservations for authenticated user. |
| `GET` | `/api/bookings/:id` | Customer | Get comprehensive details of booking, vehicle specs, price breakdown, and delivery options. |
| `PATCH` | `/api/bookings/:id/cancel` | Customer | Cancel a pending or confirmed booking prior to vehicle dispatch. |

---

## 6. Digital Rental Agreements (`/api/agreements`)

| Method | Endpoint | Access | Description |
|--------|----------|:------:|-------------|
| `GET` | `/api/agreements/booking/:bookingId` | Customer | Fetch legal agreement terms and signature status for a reservation. |
| `POST` | `/api/agreements/:id/accept` | Customer | Affix customer's digital signature and timestamp to contract terms. |
| `GET` | `/api/agreements/:id/download` | Customer | Download cryptographically sealed, tamper-evident contract PDF (`pdf_hash_sha256`). |

---

## 7. Vehicle Handovers & Digital Inspections (`/api/inspections`)

| Method | Endpoint | Access | Description |
|--------|----------|:------:|-------------|
| `GET` | `/api/inspections/booking/:bookingId` | Customer/Admin | Retrieve pickup and return inspection reports and condition diffs. |
| `POST` | `/api/inspections/:id/accept` | Customer | Customer signs off and accepts handover inspection report. |
| `GET` | `/api/inspections/photo/:photoId` | Customer/Admin | Securely stream an inspection evidence photo by ID. |

---

## 8. Pricing Engine & Delivery Routes (`/api/pricing`, `/api/locations`)

| Method | Endpoint | Access | Description |
|--------|----------|:------:|-------------|
| `POST` | `/api/pricing/calculate` | Public | Real-time multi-factor fare calculation with taxes, discounts, and deposit. |
| `GET` | `/api/pricing/config` | Public | Fetch current tax rates, base fees, and operational pricing parameters. |
| `GET` | `/api/pricing/breakdown/:bookingId` | Customer/Admin | Retrieve immutable price snapshot for a specific booking. |
| `POST` | `/api/locations/calculate-route` | Public | Calculate road distance, transit time, and doorstep delivery charge. |
| `GET` | `/api/locations/hubs` | Public | List authorized service hubs for physical vehicle pickup. |

---

## 9. AI Assistant & Smart Recommendations (`/api/ai`)

| Method | Endpoint | Access | Description |
|--------|----------|:------:|-------------|
| `POST` | `/api/ai/chat` | Public | Intelligent conversational chat endpoint supporting English and Hinglish with contextual memory. |
| `POST` | `/api/ai/recommend` | Public | Smart recommendation engine matching fleet inventory against passenger, budget, and trip criteria. |
| `GET` | `/api/ai/suggestions` | Public | Quick starter prompt chips for conversational recommendations. |

---

## 10. Fleet Administrator Operations (`/api/admin`)

### 10.1 Dashboard & Fleet Inventory
| Method | Endpoint | Access | Description |
|--------|----------|:------:|-------------|
| `GET` | `/api/admin/dashboard` | Admin | Comprehensive operational analytics: revenue, fleet utilization, document alerts. |
| `GET` | `/api/admin/vehicles` | Admin | Full fleet table with live unified availability badges and compliance pills. |
| `POST` | `/api/admin/vehicles` | Admin | Add new vehicle to fleet with image and full specifications. |
| `PUT` | `/api/admin/vehicles/:id` | Admin | Update vehicle specifications, rental rates, and operational parameters. |
| `PATCH` | `/api/admin/vehicles/:id/status` | Admin | Manually toggle operational availability (`available`, `maintenance`, `retired`). |

### 10.2 Vehicle Document Governance & Versioning
| Method | Endpoint | Access | Description |
|--------|----------|:------:|-------------|
| `GET` | `/api/admin/documents/alerts` | Admin | Retrieve fleet compliance alerts (expired, expiring $\le 30$ days, missing mandatory docs). |
| `POST` | `/api/admin/documents/scan-expiry` | Admin | Trigger immediate on-demand background expiry sweep across all fleet assets. |
| `GET` | `/api/admin/vehicles/:vehicleId/documents` | Admin | Fetch all documents associated with a specific vehicle. |
| `POST` | `/api/admin/vehicles/:vehicleId/documents` | Admin | Upload a new document for a vehicle (`rc`, `insurance`, `puc`, `fitness`, `permit`, `road_tax`). |
| `POST` | `/api/admin/documents/:id/renew` | Admin | Renew an expired document: archives superseded record and increments version counter. |
| `PATCH` | `/api/admin/documents/:id/verify` | Admin | Mark vehicle document as `valid`, record verification audit log. |
| `PATCH` | `/api/admin/documents/:id/reject` | Admin | Reject document with required administrative remarks and audit trail. |
| `GET` | `/api/admin/documents/:id/versions` | Admin | Retrieve complete version history for a vehicle document. |
| `GET` | `/api/admin/documents/versions/:versionId/download` | Admin | Securely download historical document file from previous versions. |
| `GET` | `/api/admin/documents/:id/verification-logs` | Admin | Fetch tamper-proof audit trail for document verification decisions. |

### 10.3 Customer Licence Dossier Review
| Method | Endpoint | Access | Description |
|--------|----------|:------:|-------------|
| `GET` | `/api/admin/licenses` | Admin | List all submitted customer driving licences with verification status and version tags. |
| `GET` | `/api/admin/licenses/:id` | Admin | Retrieve customer licence dossier including front/back scans and validation checks. |
| `PATCH` | `/api/admin/licenses/:id/verify` | Admin | Approve customer licence, emit notification, and unlock booking capabilities. |
| `PATCH` | `/api/admin/licenses/:id/reject` | Admin | Reject licence with mandatory remarks and customer notification. |
| `GET` | `/api/admin/licenses/:id/history` | Admin | Retrieve chronological revision history for customer licence. |
| `GET` | `/api/admin/licenses/history/:historyId/document/:side` | Admin | Download historical scan from past licence revision. |
| `GET` | `/api/admin/licenses/:id/verification-logs` | Admin | Retrieve compliance verification audit log for customer licence. |

### 10.4 Booking Administration & Inspection Execution
| Method | Endpoint | Access | Description |
|--------|----------|:------:|-------------|
| `GET` | `/api/admin/bookings` | Admin | Master booking registry with customer info, vehicle specs, and status filters. |
| `PATCH` | `/api/admin/bookings/:id/status` | Admin | Update booking state (`confirmed`, `active`, `completed`, `cancelled`). |
| `POST` | `/api/admin/inspections` | Admin | Record pickup or return vehicle inspection with odometer, fuel %, and damage notes. |
| `POST` | `/api/admin/inspections/:id/photos` | Admin | Attach photographic evidence (odometer, exterior, interior, damage) to inspection. |
| `POST` | `/api/admin/inspections/booking/:bookingId/handover` | Admin | Execute complete handover workflow: registers inspection, signs off, activates booking. |
| `POST` | `/api/admin/inspections/booking/:bookingId/complete-rental` | Admin | Execute return check-in: calculates condition diffs, logs extra charges, completes booking. |
| `POST` | `/api/admin/agreements/booking/:bookingId/generate` | Admin | Manually generate or regenerate contract agreement for reservation. |

---

## 11. Maintenance & Workshop Records (`/api/maintenance`)

| Method | Endpoint | Access | Description |
|--------|----------|:------:|-------------|
| `GET` | `/api/maintenance/stats` | Admin | Maintenance expenditure and fleet servicing metrics. |
| `GET` | `/api/maintenance/records` | Admin | Master maintenance registry with vehicle links and service filters. |
| `POST` | `/api/maintenance/records` | Admin | Schedule maintenance ticket; automatically locks calendar slots against bookings. |
| `PUT` | `/api/maintenance/records/:id` | Admin | Update service progress, parts replaced, and workshop costs. |
| `DELETE` | `/api/maintenance/records/:id` | Admin | Cancel or remove maintenance record. |
| `GET` | `/api/maintenance/reminders` | Admin | Fetch upcoming interval reminders (odometer threshold / calendar target). |

---

## 12. Notifications & User Wishlist (`/api/notifications`, `/api/wishlist`)

| Method | Endpoint | Access | Description |
|--------|----------|:------:|-------------|
| `GET` | `/api/notifications` | Customer | Fetch user notification inbox with read/unread statuses. |
| `PATCH` | `/api/notifications/:id/read` | Customer | Mark a specific notification as read. |
| `PATCH` | `/api/notifications/read-all` | Customer | Mark all user notifications as read. |
| `GET` | `/api/wishlist` | Customer | Retrieve customer's saved favorite vehicles. |
| `POST` | `/api/wishlist/:vehicleId` | Customer | Add vehicle to customer wishlist. |
| `DELETE` | `/api/wishlist/:vehicleId` | Customer | Remove vehicle from wishlist. |

