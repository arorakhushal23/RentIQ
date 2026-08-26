-- =========================================================
-- RentIQ Seed Data
-- Sample rows for local development/testing.
-- Run this AFTER schema.sql.
-- =========================================================

USE rentiq;

-- ---------------------------------------------------------
-- Categories
-- ---------------------------------------------------------
INSERT INTO categories (name) VALUES
    ('Hatchback'),
    ('Sedan'),
    ('SUV'),
    ('Bike'),
    ('Scooter'),
    ('EV');

-- ---------------------------------------------------------
-- Users
-- NOTE: password_hash values below are PLACEHOLDERS ONLY —
-- these are NOT real bcrypt hashes. Real hashing happens in
-- the Auth backend task (Phase 3), which we haven't built yet.
-- Do not treat these as valid login credentials.
-- ---------------------------------------------------------
INSERT INTO users (name, email, password_hash, role) VALUES
    ('Admin User',   'admin@rentiq.com',   'PLACEHOLDER_HASH', 'admin'),
    ('Khushal Arora','khushal@example.com','PLACEHOLDER_HASH', 'customer'),
    ('Priya Sharma', 'priya@example.com',  'PLACEHOLDER_HASH', 'customer');

-- ---------------------------------------------------------
-- Vehicles
-- category_id references: 1=Hatchback 2=Sedan 3=SUV 4=Bike 5=Scooter 6=EV
-- ---------------------------------------------------------
INSERT INTO vehicles (category_id, name, brand, seating_capacity, transmission, price_per_day, is_available, image_url) VALUES
    (1, 'Swift',        'Maruti Suzuki', 5, 'manual',    1800.00, TRUE, NULL),
    (1, 'i20',           'Hyundai',       5, 'automatic', 2200.00, TRUE, NULL),
    (2, 'City',           'Honda',         5, 'automatic', 2600.00, TRUE, NULL),
    (2, 'Verna',           'Hyundai',       5, 'automatic', 2800.00, TRUE, NULL),
    (3, 'Creta',             'Hyundai',       5, 'automatic', 3200.00, TRUE, NULL),
    (3, 'Scorpio',             'Mahindra',      7, 'manual',    3500.00, TRUE, NULL),
    (4, 'Classic 350',           'Royal Enfield', 2, 'manual',    900.00,  TRUE, NULL),
    (4, 'Pulsar 150',              'Bajaj',         2, 'manual',    700.00,  TRUE, NULL),
    (5, 'Activa',                    'Honda',         2, 'automatic', 500.00,  TRUE, NULL),
    (6, 'Nexon EV',                    'Tata',          5, 'automatic', 3000.00, TRUE, NULL);

-- ---------------------------------------------------------
-- Bookings
-- user_id 2 = Khushal, user_id 3 = Priya
-- vehicle_id 1 = Swift, vehicle_id 5 = Creta
-- ---------------------------------------------------------
INSERT INTO bookings (user_id, vehicle_id, start_date, end_date, total_price, status) VALUES
    (2, 1, '2026-08-20', '2026-08-22', 3600.00, 'confirmed'),
    (3, 5, '2026-08-25', '2026-08-28', 9600.00, 'pending');

-- ---------------------------------------------------------
-- Payments
-- One-to-one with bookings above
-- ---------------------------------------------------------
INSERT INTO payments (booking_id, amount, payment_method, payment_status, paid_at) VALUES
    (1, 3600.00, 'upi', 'success', '2026-08-19 10:15:00'),
    (2, 9600.00, 'card', 'pending', NULL);

-- ---------------------------------------------------------
-- Reviews
-- ---------------------------------------------------------
INSERT INTO reviews (user_id, vehicle_id, rating, comment) VALUES
    (2, 1, 5, 'Smooth ride, great mileage, would rent again.'),
    (3, 5, 4, 'Comfortable SUV but pickup process took a while.');

-- ---------------------------------------------------------
-- Wishlist
-- ---------------------------------------------------------
INSERT INTO wishlist (user_id, vehicle_id) VALUES
    (2, 6),  -- Khushal wishlists the Scorpio
    (3, 10); -- Priya wishlists the Nexon EV