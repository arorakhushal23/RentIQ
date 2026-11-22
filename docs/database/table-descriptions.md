# RentIQ Detailed Database Table Descriptions

This document provides exhaustive, column-level descriptions for all **27 database tables** in the RentIQ vehicle rental platform.

---

## 1. Domain: Identity, Authentication & Communication

### 1.1 `users`
Stores primary customer and administrator accounts.

| Column | Data Type | Nullable | Key | Default | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `user_id` | `INT` | NO | PK | *auto_increment* | Unique identifier for each system user. |
| `name` | `VARCHAR(100)` | NO | | `NULL` | Full legal name of user. |
| `email` | `VARCHAR(100)` | NO | UNI | `NULL` | User email address; unique login identifier. |
| `password_hash` | `VARCHAR(255)` | NO | | `NULL` | Bcrypt hashed password string. |
| `role` | `ENUM('customer','admin')` | NO | | `'customer'` | Access authorization role. |
| `created_at` | `TIMESTAMP` | YES | | `CURRENT_TIMESTAMP` | Account creation timestamp. |

### 1.2 `password_reset_tokens`
Stores cryptographically secure, time-bounded tokens for self-service password recovery.

| Column | Data Type | Nullable | Key | Default | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `INT` | NO | PK | *auto_increment* | Primary key identifier. |
| `user_id` | `INT` | NO | FK | `NULL` | References `users(user_id)`. |
| `token_hash` | `VARCHAR(64)` | NO | UNI | `NULL` | SHA-256 hash of random reset token. |
| `expires_at` | `DATETIME` | NO | MUL | `NULL` | Expiry timestamp (typically 1 hour). |
| `used` | `TINYINT(1)` | NO | | `0` | Flag marking token redemption. |
| `created_at` | `TIMESTAMP` | YES | | `CURRENT_TIMESTAMP` | Token generation timestamp. |

### 1.3 `notifications`
Stores in-app notifications dispatched to customers and administrators.

| Column | Data Type | Nullable | Key | Default | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `notification_id` | `INT` | NO | PK | *auto_increment* | Primary key. |
| `user_id` | `INT` | NO | FK | `NULL` | Recipient user ID (`users.user_id`). |
| `type` | `VARCHAR(50)` | NO | | `NULL` | Category tag (e.g. `doc_alert`, `license_verified`). |
| `title` | `VARCHAR(150)` | NO | | `NULL` | Short summary title. |
| `message` | `TEXT` | NO | | `NULL` | Notification body text. |
| `related_record_id`| `INT` | YES | | `NULL` | Target entity ID (e.g. `vehicle_id`, `license_id`). |
| `is_read` | `TINYINT(1)` | NO | | `0` | Unread (0) or Read (1) status flag. |
| `created_at` | `TIMESTAMP` | YES | | `CURRENT_TIMESTAMP` | Dispatch timestamp. |

### 1.4 `contact_messages`
Stores customer support inquiries sent via contact forms.

| Column | Data Type | Nullable | Key | Default | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `INT` | NO | PK | *auto_increment* | Message primary key. |
| `name` | `VARCHAR(100)` | NO | | `NULL` | Sender contact name. |
| `email` | `VARCHAR(100)` | NO | | `NULL` | Sender contact email. |
| `subject` | `VARCHAR(150)` | YES | | `NULL` | Inquiry subject line. |
| `message` | `TEXT` | NO | | `NULL` | Message content. |
| `status` | `ENUM('pending','responded','resolved')` | NO | | `'pending'` | Processing status. |
| `created_at` | `TIMESTAMP` | YES | | `CURRENT_TIMESTAMP` | Message timestamp. |

---

## 2. Domain: Fleet Catalog & Asset Management

### 2.1 `categories`
Vehicle categories governing classification and rental rules.

| Column | Data Type | Nullable | Key | Default | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `category_id` | `INT` | NO | PK | *auto_increment* | Primary key. |
| `name` | `VARCHAR(50)` | NO | UNI | `NULL` | Category name (Sedan, SUV, Sports, Hatchback, etc.). |
| `description` | `TEXT` | YES | | `NULL` | Category summary. |
| `image_url` | `VARCHAR(255)` | YES | | `NULL` | Representative image URL. |
| `created_at` | `TIMESTAMP` | YES | | `CURRENT_TIMESTAMP` | Record timestamp. |

### 2.2 `vehicles`
The foundational asset entity tracking physical, technical, and operational properties.

| Column | Data Type | Nullable | Key | Default | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `vehicle_id` | `INT` | NO | PK | *auto_increment* | Primary key. |
| `category_id` | `INT` | NO | FK | `NULL` | References `categories(category_id)`. |
| `name` | `VARCHAR(100)` | NO | | `NULL` | Vehicle commercial model name. |
| `brand` | `VARCHAR(50)` | NO | | `NULL` | Manufacturer / Make (e.g. Hyundai, BMW, Maruti). |
| `model` | `VARCHAR(100)` | YES | | `NULL` | Specific trim / variant designation. |
| `manufacturing_year`| `INT` | YES | | `NULL` | Year of manufacture. |
| `vehicle_color` | `VARCHAR(50)` | YES | | `NULL` | Exterior vehicle paint color. |
| `registration_number`| `VARCHAR(50)`| YES | UNI | `NULL` | Unique RTO vehicle registration number. |
| `registration_state` | `VARCHAR(100)`| YES | | `NULL` | Indian state / territory of registration. |
| `registration_date` | `DATE` | YES | | `NULL` | Date of original registration. |
| `registration_validity`| `DATE` | YES | | `NULL` | Date RC validity expires. |
| `fuel_type` | `ENUM('petrol','diesel','electric','hybrid','cng')` | YES | | `'petrol'` | Powertrain fuel classification. |
| `mileage` | `VARCHAR(50)` | YES | | `NULL` | Fuel efficiency rating. |
| `engine_capacity` | `VARCHAR(100)`| YES | | `NULL` | Engine displacement (cc) or battery rating (kWh). |
| `description` | `TEXT` | YES | | `NULL` | Vehicle marketing overview and feature list. |
| `engine_number` | `VARCHAR(100)`| YES | | `NULL` | Stamped engine serial number (restricted to admin). |
| `chassis_number`| `VARCHAR(100)`| YES | | `NULL` | Chassis serial number (restricted to admin). |
| `vehicle_identification_number` | `VARCHAR(100)` | YES | | `NULL` | 17-digit VIN (restricted to admin). |
| `doors` | `INT` | YES | | `4` | Number of passenger doors. |
| `boot_space` | `VARCHAR(50)` | YES | | `NULL` | Cargo trunk volume (litres / bags). |
| `max_passengers`| `INT` | YES | | `NULL` | Maximum authorized occupancy. |
| `seating_capacity`| `INT` | NO | | `NULL` | Total passenger seats. |
| `transmission` | `VARCHAR(20)` | NO | | `NULL` | `manual` or `automatic`. |
| `price_per_day` | `DECIMAL(10,2)`| NO | | `NULL` | Base daily rental tariff in INR. |
| `is_available` | `TINYINT(1)` | YES | | `1` | Administrative operational availability toggle. |
| `image_url` | `VARCHAR(255)` | YES | | `NULL` | Primary catalogue exterior photograph path. |
| `created_at` | `TIMESTAMP` | YES | | `CURRENT_TIMESTAMP` | Vehicle onboarding timestamp. |

### 2.3 `service_hubs`
Physical hub centers for vehicle pickup and return.

| Column | Data Type | Nullable | Key | Default | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `hub_id` | `INT` | NO | PK | *auto_increment* | Primary key. |
| `hub_name` | `VARCHAR(100)` | NO | | `NULL` | Operational hub title. |
| `address` | `VARCHAR(255)` | NO | | `NULL` | Physical street address. |
| `city` | `VARCHAR(100)` | NO | | `NULL` | City location. |
| `latitude` | `DECIMAL(10,8)`| NO | | `NULL` | GPS coordinate latitude. |
| `longitude` | `DECIMAL(11,8)`| NO | | `NULL` | GPS coordinate longitude. |
| `is_active` | `TINYINT(1)` | NO | | `1` | Operational status toggle. |
| `created_at` | `TIMESTAMP` | YES | | `CURRENT_TIMESTAMP` | Creation timestamp. |

### 2.4 `wishlist`
Customer bookmarks for vehicles.

| Column | Data Type | Nullable | Key | Default | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `INT` | NO | PK | *auto_increment* | Primary key. |
| `user_id` | `INT` | NO | FK | `NULL` | References `users(user_id)`. |
| `vehicle_id` | `INT` | NO | FK | `NULL` | References `vehicles(vehicle_id)`. |
| `created_at` | `TIMESTAMP` | YES | | `CURRENT_TIMESTAMP` | Bookmarking timestamp. |

### 2.5 `reviews`
Verified vehicle ratings and reviews.

| Column | Data Type | Nullable | Key | Default | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `review_id` | `INT` | NO | PK | *auto_increment* | Primary key. |
| `user_id` | `INT` | NO | FK | `NULL` | References `users(user_id)`. |
| `vehicle_id` | `INT` | NO | FK | `NULL` | References `vehicles(vehicle_id)`. |
| `rating` | `INT` | NO | | `NULL` | Rating integer from 1 to 5. |
| `comment` | `TEXT` | YES | | `NULL` | Written review feedback. |
| `created_at` | `TIMESTAMP` | YES | | `CURRENT_TIMESTAMP` | Submission timestamp. |

---

## 3. Domain: Regulatory Compliance & Document Management

### 3.1 `vehicle_documents`
Current active compliance certificates for fleet vehicles.

| Column | Data Type | Nullable | Key | Default | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `INT` | NO | PK | *auto_increment* | Primary key. |
| `vehicle_id` | `INT` | NO | FK | `NULL` | References `vehicles(vehicle_id)`. |
| `document_type` | `ENUM('rc','insurance','puc','fitness','permit','road_tax')` | NO | MUL | `NULL` | Compliance certificate category. |
| `document_number`| `VARCHAR(100)`| NO | | `NULL` | Policy, certificate, or registration number. |
| `issue_date` | `DATE` | YES | | `NULL` | Certificate issuance date. |
| `expiry_date` | `DATE` | NO | MUL | `NULL` | Mandatory certificate expiration date. |
| `file_path` | `VARCHAR(255)` | NO | | `NULL` | Secure filename stored in `uploads/vehicle_documents`. |
| `verification_status`| `ENUM('valid','expiring_soon','expired','pending','rejected')` | NO | | `'valid'` | Current document state. |
| `version` | `INT` | NO | | `1` | Active version number (increments upon renewal). |
| `admin_remarks` | `TEXT` | YES | | `NULL` | Administrative audit notes or rejection reasons. |
| `uploaded_at` | `TIMESTAMP` | YES | | `CURRENT_TIMESTAMP` | Initial upload timestamp. |
| `updated_at` | `TIMESTAMP` | YES | | `CURRENT_TIMESTAMP` | Last updated timestamp. |

### 3.2 `vehicle_document_versions`
Historical archive preserving previous versions when vehicle documents are renewed.

| Column | Data Type | Nullable | Key | Default | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `INT` | NO | PK | *auto_increment* | Version record primary key. |
| `document_id` | `INT` | NO | MUL | `NULL` | References parent active document ID. |
| `vehicle_id` | `INT` | NO | FK | `NULL` | References `vehicles(vehicle_id)`. |
| `document_type` | `ENUM(...)` | NO | MUL | `NULL` | Certificate type. |
| `version_number`| `INT` | NO | | `1` | Archived version sequence number (1, 2, ...). |
| `document_number`| `VARCHAR(100)`| NO | | `NULL` | Archived certificate/policy number. |
| `issue_date` | `DATE` | YES | | `NULL` | Archived issue date. |
| `expiry_date` | `DATE` | NO | | `NULL` | Archived expiry date. |
| `file_path` | `VARCHAR(255)` | NO | | `NULL` | Preserved document file path. |
| `verification_status`| `VARCHAR(50)`| NO | | `NULL` | Status when archived. |
| `admin_remarks` | `TEXT` | YES | | `NULL` | Preserved administrative notes. |
| `archived_at` | `TIMESTAMP` | YES | | `CURRENT_TIMESTAMP` | Timestamp when superseded by new version. |
| `archived_by` | `INT` | YES | FK | `NULL` | Administrator ID who authorized renewal (`users.user_id`). |

### 3.3 `customer_licenses`
Active driving licence records submitted by customers.

| Column | Data Type | Nullable | Key | Default | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `INT` | NO | PK | *auto_increment* | Primary key. |
| `user_id` | `INT` | NO | FK,UNI| `NULL` | References `users(user_id)`. Unique (1 licence per user). |
| `license_number`| `VARCHAR(100)`| NO | | `NULL` | Driving licence number (masked in general listings). |
| `holder_name` | `VARCHAR(150)` | NO | | `NULL` | Full name as printed on driving licence card. |
| `date_of_birth` | `DATE` | YES | | `NULL` | Date of birth (must be 18+). |
| `issue_date` | `DATE` | NO | | `NULL` | Date of licence issuance. |
| `expiry_date` | `DATE` | NO | | `NULL` | Date of licence expiration. |
| `vehicle_class` | `VARCHAR(50)` | NO | | `'LMV'` | Authorized vehicle class (`LMV`, `MCWG`, `ALL`). |
| `front_document_path`| `VARCHAR(255)`| NO | | `NULL` | Secure filename for front licence card image/PDF. |
| `back_document_path` | `VARCHAR(255)`| YES | | `NULL` | Secure filename for rear licence card image/PDF. |
| `verification_status`| `ENUM('not_submitted','pending','verified','rejected','expired')` | NO | MUL | `'pending'` | Current verification review state. |
| `version` | `INT` | NO | | `1` | Active version number (increments upon resubmission). |
| `rejection_reason` | `TEXT` | YES | | `NULL` | Mandatory reason recorded when admin rejects licence. |
| `verified_by` | `INT` | YES | FK | `NULL` | Administrator who reviewed licence (`users.user_id`). |
| `verified_at` | `DATETIME` | YES | | `NULL` | Timestamp of administrative review. |
| `created_at` | `TIMESTAMP` | YES | | `CURRENT_TIMESTAMP` | Initial submission timestamp. |
| `updated_at` | `TIMESTAMP` | YES | | `CURRENT_TIMESTAMP` | Last updated timestamp. |

### 3.4 `customer_license_history`
Historical archive preserving previous customer licence submissions when renewed.

| Column | Data Type | Nullable | Key | Default | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `INT` | NO | PK | *auto_increment* | Primary key. |
| `license_id` | `INT` | NO | MUL | `NULL` | References parent `customer_licenses.id`. |
| `user_id` | `INT` | NO | FK | `NULL` | References `users(user_id)`. |
| `version_number`| `INT` | NO | | `1` | Archived submission version sequence number. |
| `license_number`| `VARCHAR(100)`| NO | | `NULL` | Archived licence number. |
| `holder_name` | `VARCHAR(150)` | NO | | `NULL` | Archived holder name. |
| `date_of_birth` | `DATE` | YES | | `NULL` | Archived date of birth. |
| `issue_date` | `DATE` | NO | | `NULL` | Archived issue date. |
| `expiry_date` | `DATE` | NO | | `NULL` | Archived expiry date. |
| `vehicle_class` | `VARCHAR(50)` | NO | | `'LMV'` | Archived vehicle class. |
| `front_document_path`| `VARCHAR(255)`| NO | | `NULL` | Archived front image path. |
| `back_document_path` | `VARCHAR(255)`| YES | | `NULL` | Archived rear image path. |
| `verification_status`| `VARCHAR(50)`| NO | | `NULL` | Status when archived. |
| `rejection_reason` | `TEXT` | YES | | `NULL` | Archived rejection reason if any. |
| `verified_by` | `INT` | YES | FK | `NULL` | Admin ID who reviewed this archived version. |
| `verified_at` | `DATETIME` | YES | | `NULL` | Verification timestamp. |
| `archived_at` | `TIMESTAMP` | YES | | `CURRENT_TIMESTAMP` | Timestamp when superseded. |

### 3.5 `document_verification_logs`
Immutable audit log recording every administrative approval, rejection, and renewal action.

| Column | Data Type | Nullable | Key | Default | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `INT` | NO | PK | *auto_increment* | Log entry ID. |
| `document_type` | `ENUM('vehicle_document','customer_license')` | NO | MUL | `NULL` | Target domain classification. |
| `document_id` | `INT` | NO | MUL | `NULL` | ID of the target document / licence. |
| `reference_id` | `VARCHAR(100)` | YES | | `NULL` | Natural identifier (e.g. reg number or licence number). |
| `previous_status`| `VARCHAR(50)` | NO | | `NULL` | Status before administrative action. |
| `new_status` | `VARCHAR(50)` | NO | | `NULL` | Status assigned by administrator. |
| `admin_id` | `INT` | NO | FK | `NULL` | Admin user ID who executed action (`users.user_id`). |
| `remarks` | `TEXT` | YES | | `NULL` | Explanatory notes, rejection reasons, or audit remarks. |
| `created_at` | `TIMESTAMP` | YES | MUL | `CURRENT_TIMESTAMP` | Timestamp of administrative action. |

---

## 4. Domain: Bookings & Reservations

### 4.1 `bookings`
Core rental reservation record.

| Column | Data Type | Nullable | Key | Default | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `booking_id` | `INT` | NO | PK | *auto_increment* | Primary reservation identifier. |
| `user_id` | `INT` | NO | FK | `NULL` | Renter user account (`users.user_id`). |
| `vehicle_id` | `INT` | NO | FK | `NULL` | Reserved vehicle (`vehicles.vehicle_id`). |
| `pickup_datetime` | `DATETIME` | NO | MUL | `NULL` | Scheduled reservation start datetime. |
| `return_datetime` | `DATETIME` | NO | MUL | `NULL` | Scheduled reservation end datetime. |
| `total_price` | `DECIMAL(10,2)`| NO | | `NULL` | Authoritative gross rental total. |
| `status` | `ENUM('pending','confirmed','active','completed','cancelled')` | NO | MUL | `'pending'` | Lifecycle booking state. |
| `delivery_type` | `ENUM('hub_pickup','doorstep_delivery')` | NO | | `'hub_pickup'`| Handover fulfillment method. |
| `delivery_address`| `TEXT` | YES | | `NULL` | Drop-off address for doorstep delivery. |
| `delivery_charge` | `DECIMAL(10,2)`| YES | | `0.00` | Doorstep delivery charge calculated by distance. |
| `created_at` | `TIMESTAMP` | YES | | `CURRENT_TIMESTAMP` | Booking creation timestamp. |

### 4.2 `booking_price_breakdown`
Immutable breakdown snapshot preserving financial components at confirmation.

| Column | Data Type | Nullable | Key | Default | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `INT` | NO | PK | *auto_increment* | Primary key. |
| `booking_id` | `INT` | NO | FK,UNI| `NULL` | References `bookings(booking_id)`. Exactly 1 snapshot per booking. |
| `base_rental_price` | `DECIMAL(10,2)` | NO | | `NULL` | Gross base tariff before adjustments. |
| `duration_discount_amount`| `DECIMAL(10,2)`| NO | | `0.00` | Discount applied for long rentals (e.g. 7+ days). |
| `weekend_surcharge_amount`| `DECIMAL(10,2)`| NO | | `0.00` | Friday/Saturday/Sunday peak adjustment. |
| `seasonal_surcharge_amount`| `DECIMAL(10,2)`| NO | | `0.00` | Festive / seasonal holiday adjustment. |
| `delivery_charge_amount` | `DECIMAL(10,2)` | NO | | `0.00` | Doorstep delivery fee. |
| `add_ons_amount` | `DECIMAL(10,2)` | NO | | `0.00` | Add-on equipment (GPS, child seat). |
| `security_deposit_amount`| `DECIMAL(10,2)` | NO | | `0.00` | Refundable caution deposit. |
| `tax_amount` | `DECIMAL(10,2)` | NO | | `0.00` | Applicable GST / taxes. |
| `total_final_price` | `DECIMAL(10,2)` | NO | | `NULL` | Total payable amount. |
| `created_at` | `TIMESTAMP` | YES | | `CURRENT_TIMESTAMP` | Calculation snapshot timestamp. |

### 4.3 `booking_additional_charges`
Tracks post-rental charges evaluated upon vehicle return.

| Column | Data Type | Nullable | Key | Default | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `INT` | NO | PK | *auto_increment* | Primary key. |
| `booking_id` | `INT` | NO | FK | `NULL` | References `bookings(booking_id)`. |
| `charge_type` | `VARCHAR(50)` | NO | | `NULL` | Type (`late_return`, `excess_km`, `fuel_deficit`, `damage`). |
| `amount` | `DECIMAL(10,2)` | NO | | `NULL` | Assessed charge in INR. |
| `reason` | `TEXT` | YES | | `NULL` | Specific justification. |
| `payment_status`| `VARCHAR(20)` | NO | | `'pending'` | Settlement status (`pending`, `paid`, `waived`). |
| `created_at` | `TIMESTAMP` | YES | | `CURRENT_TIMESTAMP` | Assessment timestamp. |

### 4.4 `payments`
Financial transaction records for bookings.

| Column | Data Type | Nullable | Key | Default | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `payment_id` | `INT` | NO | PK | *auto_increment* | Payment primary key. |
| `booking_id` | `INT` | NO | FK | `NULL` | References `bookings(booking_id)`. |
| `amount` | `DECIMAL(10,2)`| NO | | `NULL` | Paid amount in INR. |
| `payment_method`| `VARCHAR(50)` | NO | | `NULL` | Channel (`credit_card`, `debit_card`, `upi`, `net_banking`). |
| `status` | `ENUM('pending','completed','failed','refunded')` | NO | | `'pending'` | Transaction state. |
| `transaction_id`| `VARCHAR(100)`| YES | | `NULL` | Gateway reference number. |
| `payment_date` | `TIMESTAMP` | YES | | `CURRENT_TIMESTAMP` | Transaction execution timestamp. |

### 4.5 `rental_agreements`
Legally binding digital contracts signed between RentIQ and customer.

| Column | Data Type | Nullable | Key | Default | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `INT` | NO | PK | *auto_increment* | Agreement ID. |
| `booking_id` | `INT` | NO | FK,UNI| `NULL` | References `bookings(booking_id)`. Exactly 1 per booking. |
| `user_id` | `INT` | NO | FK | `NULL` | References `users(user_id)`. |
| `agreement_number`| `VARCHAR(50)` | NO | UNI | `NULL` | Formal contract number (e.g. `RIQ-AGR-638-MWD91F3E`). |
| `status` | `VARCHAR(30)` | NO | | `'pending_acceptance'` | Acceptance state (`pending_acceptance`, `accepted`, `terminated`). |
| `customer_accepted` | `TINYINT(1)` | NO | | `0` | Digital sign-off flag. |
| `customer_accepted_at` | `DATETIME` | YES | | `NULL` | Timestamp when customer accepted agreement. |
| `pdf_path` | `VARCHAR(255)` | YES | | `NULL` | Generated legally stamped PDF contract on disk. |
| `created_at` | `TIMESTAMP` | YES | | `CURRENT_TIMESTAMP` | Contract generation timestamp. |

---

## 5. Domain: Handover Inspections & Evidence

### 5.1 `vehicle_inspections`
Handover condition checks performed at pickup and return.

| Column | Data Type | Nullable | Key | Default | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `INT` | NO | PK | *auto_increment* | Inspection primary key. |
| `booking_id` | `INT` | NO | FK | `NULL` | References `bookings(booking_id)`. |
| `vehicle_id` | `INT` | NO | FK | `NULL` | References `vehicles(vehicle_id)`. |
| `stage` | `ENUM('pickup','return')` | NO | | `NULL` | Inspection checkpoint. |
| `odometer_reading` | `INT` | NO | | `NULL` | Vehicle odometer in kilometers. |
| `fuel_level_percent` | `DECIMAL(5,2)` | NO | | `NULL` | Fuel / battery level percentage (0 to 100). |
| `exterior_condition` | `TEXT` | YES | | `NULL` | Observed scratches, dents, or paint defects. |
| `interior_condition` | `TEXT` | YES | | `NULL` | Cleanliness, upholstery, and accessory condition. |
| `customer_confirmed` | `TINYINT(1)` | NO | | `0` | Customer digital sign-off confirming inspection report. |
| `inspected_by` | `INT` | YES | FK | `NULL` | Admin / hub agent who conducted inspection (`users.user_id`). |
| `created_at` | `TIMESTAMP` | YES | | `CURRENT_TIMESTAMP` | Inspection completion timestamp. |

### 5.2 `inspection_photos`
Photographic evidence attached to vehicle inspections.

| Column | Data Type | Nullable | Key | Default | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `INT` | NO | PK | *auto_increment* | Primary key. |
| `inspection_id`| `INT` | NO | FK | `NULL` | References `vehicle_inspections(id)`. |
| `photo_url` | `VARCHAR(255)` | NO | | `NULL` | Stored photo filename in `uploads/inspection_photos`. |
| `tag` | `VARCHAR(50)` | YES | | `'general'`| Angle tag (`front`, `rear`, `left_side`, `right_side`, `odometer`, `fuel_gauge`, `damage`). |
| `created_at` | `TIMESTAMP` | YES | | `CURRENT_TIMESTAMP` | Photo upload timestamp. |

---

## 6. Domain: Fleet Maintenance & Servicing

### 6.1 `vehicle_maintenance`
Maintenance service jobs, workshop repairs, and scheduled checkups.

| Column | Data Type | Nullable | Key | Default | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `INT` | NO | PK | *auto_increment* | Maintenance primary key. |
| `vehicle_id` | `INT` | NO | FK | `NULL` | References `vehicles(vehicle_id)`. |
| `maintenance_category`| `VARCHAR(50)` | NO | | `NULL` | Category (`regular_service`, `brake_servicing`, `oil_change`, `tyre_replacement`, etc.). |
| `start_date` | `DATE` | YES | MUL | `NULL` | Scheduled beginning of workshop downtime. |
| `end_date` | `DATE` | YES | MUL | `NULL` | Scheduled completion of workshop downtime. |
| `odometer_reading` | `INT` | YES | | `NULL` | Odometer at time of service. |
| `cost` | `DECIMAL(10,2)`| YES | | `0.00` | Incurred expense in INR. |
| `status` | `VARCHAR(30)` | NO | MUL | `'scheduled'`| Workshop state (`scheduled`, `in_progress`, `completed`, `cancelled`). |
| `service_center` | `VARCHAR(150)`| YES | | `NULL` | Authorized workshop name / location. |
| `description` | `TEXT` | YES | | `NULL` | Detailed mechanic diagnosis and repairs conducted. |
| `created_by` | `INT` | YES | FK | `NULL` | Administrator who scheduled job (`users.user_id`). |
| `created_at` | `TIMESTAMP` | YES | | `CURRENT_TIMESTAMP` | Record creation timestamp. |

### 6.2 `maintenance_reminders`
Automated predictive service reminders.

| Column | Data Type | Nullable | Key | Default | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `INT` | NO | PK | *auto_increment* | Reminder primary key. |
| `vehicle_id` | `INT` | NO | FK | `NULL` | References `vehicles(vehicle_id)`. |
| `reminder_type` | `VARCHAR(50)` | NO | | `NULL` | Type (`due_date`, `due_odometer`, `overdue`). |
| `title` | `VARCHAR(150)` | NO | | `NULL` | Reminder summary title. |
| `description` | `TEXT` | YES | | `NULL` | Detailed maintenance guidance. |
| `due_date` | `DATE` | YES | | `NULL` | Milestone target calendar date. |
| `due_odometer` | `INT` | YES | | `NULL` | Milestone target odometer reading. |
| `status` | `VARCHAR(30)` | NO | | `'pending'` | Alert state (`pending`, `completed`, `dismissed`). |
| `created_at` | `TIMESTAMP` | YES | | `CURRENT_TIMESTAMP` | Alert generation timestamp. |

---

## 7. Domain: Dynamic Pricing & Distance Rules

### 7.1 `pricing_rules`
Global rules for duration discounts and peak surcharges.

| Column | Data Type | Nullable | Key | Default | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `INT` | NO | PK | *auto_increment* | Rule primary key. |
| `rule_code` | `VARCHAR(50)` | NO | UNI | `NULL` | Unique code (e.g. `WEEKLY_DISCOUNT_7D`, `WEEKEND_PEAK_SURCHARGE`). |
| `rule_name` | `VARCHAR(100)` | NO | | `NULL` | Human-readable title. |
| `rule_type` | `VARCHAR(50)` | NO | | `NULL` | Category (`duration_discount`, `surcharge`, `deposit`). |
| `value` | `DECIMAL(10,2)`| NO | | `NULL` | Numeric percentage or fixed amount. |
| `is_active` | `TINYINT(1)` | NO | | `1` | Operational toggle. |
| `created_at` | `TIMESTAMP` | YES | | `CURRENT_TIMESTAMP` | Creation timestamp. |

### 7.2 `delivery_pricing_rules`
Distance-based doorstep delivery calculation rules.

| Column | Data Type | Nullable | Key | Default | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `rule_id` | `INT` | NO | PK | *auto_increment* | Primary key. |
| `rule_name` | `VARCHAR(100)` | NO | | `NULL` | Rule label. |
| `base_delivery_fee` | `DECIMAL(10,2)` | NO | | `0.00` | Flat base fee for dispatch. |
| `per_km_rate` | `DECIMAL(10,2)` | NO | | `15.00`| Rate per kilometer from closest hub. |
| `free_delivery_threshold_km`| `DECIMAL(6,2)`| NO | | `0.00` | Radius within which delivery is complimentary. |
| `max_delivery_radius_km` | `DECIMAL(6,2)`| NO | | `50.00`| Maximum allowable delivery distance. |
| `is_active` | `TINYINT(1)` | NO | | `1` | Active toggle. |
| `created_at` | `TIMESTAMP` | YES | | `CURRENT_TIMESTAMP` | Timestamp. |

### 7.3 `seasonal_pricing`
Calendar-bound seasonal demand multipliers.

| Column | Data Type | Nullable | Key | Default | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `INT` | NO | PK | *auto_increment* | Primary key. |
| `season_name` | `VARCHAR(100)` | NO | | `NULL` | Name of holiday or seasonal period. |
| `start_date` | `DATE` | NO | | `NULL` | Starting date of season. |
| `end_date` | `DATE` | NO | | `NULL` | Ending date of season. |
| `multiplier` | `DECIMAL(4,2)` | NO | | `1.00` | Price multiplier (e.g. 1.25 for +25%). |
| `is_active` | `TINYINT(1)` | NO | | `1` | Active toggle. |
| `created_at` | `TIMESTAMP` | YES | | `CURRENT_TIMESTAMP` | Creation timestamp. |

### 7.4 `additional_charge_rules`
Defines standard rates for post-rental adjustments.

| Column | Data Type | Nullable | Key | Default | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `INT` | NO | PK | *auto_increment* | Primary key. |
| `charge_code` | `VARCHAR(50)` | NO | UNI | `NULL` | Code (e.g. `LATE_RETURN_FEE`, `EXCESS_KM_FEE`, `FUEL_REFILL_SURCHARGE`). |
| `charge_name` | `VARCHAR(100)` | NO | | `NULL` | Descriptive title. |
| `default_amount`| `DECIMAL(10,2)`| NO | | `NULL` | Standard rate in INR. |
| `rate_unit` | `VARCHAR(30)` | NO | | `'flat'` | Computation unit (`per_hour`, `per_km`, `per_litre`, `flat`). |
| `is_active` | `TINYINT(1)` | NO | | `1` | Active toggle. |
| `created_at` | `TIMESTAMP` | YES | | `CURRENT_TIMESTAMP` | Record timestamp. |

