-- =========================================================
-- RentIQ Database Schema
-- Phase 2: Database Design
-- =========================================================

CREATE DATABASE IF NOT EXISTS rentiq;
USE rentiq;

-- ---------------------------------------------------------
-- Users
-- Stores both customers and admins (role column distinguishes them)
-- ---------------------------------------------------------
CREATE TABLE users (
    user_id       INT AUTO_INCREMENT PRIMARY KEY,
    name          VARCHAR(100)        NOT NULL,
    email         VARCHAR(150)        NOT NULL UNIQUE,
    password_hash VARCHAR(255)        NOT NULL,
    role          ENUM('customer','admin') NOT NULL DEFAULT 'customer',
    created_at    TIMESTAMP           DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------
-- Categories
-- e.g. SUV, Sedan, Bike, Scooter, EV
-- ---------------------------------------------------------
CREATE TABLE categories (
    category_id   INT AUTO_INCREMENT PRIMARY KEY,
    name          VARCHAR(50)         NOT NULL UNIQUE
);

-- ---------------------------------------------------------
-- Vehicles
-- One category has many vehicles (1:N)
-- ---------------------------------------------------------
CREATE TABLE vehicles (
    vehicle_id    INT AUTO_INCREMENT PRIMARY KEY,
    category_id   INT                 NOT NULL,
    name          VARCHAR(100)        NOT NULL,
    brand         VARCHAR(50),
    seating_capacity INT              NOT NULL,
    transmission  ENUM('automatic','manual') NOT NULL,
    price_per_day DECIMAL(10,2)       NOT NULL,
    is_available  BOOLEAN             DEFAULT TRUE,
    image_url     VARCHAR(255),
    created_at    TIMESTAMP           DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (category_id) REFERENCES categories(category_id)
        ON DELETE RESTRICT
);

-- ---------------------------------------------------------
-- Bookings
-- Full entity (not a bare junction table) — has its own
-- lifecycle: dates, status, price. This is where we will
-- later enforce "no overlapping bookings per vehicle."
-- ---------------------------------------------------------
CREATE TABLE bookings (
    booking_id    INT AUTO_INCREMENT PRIMARY KEY,
    user_id       INT                 NOT NULL,
    vehicle_id    INT                 NOT NULL,
    start_date    DATE                NOT NULL,
    end_date      DATE                NOT NULL,
    total_price   DECIMAL(10,2)       NOT NULL,
    status        ENUM('pending','confirmed','cancelled','completed')
                                       NOT NULL DEFAULT 'pending',
    created_at    TIMESTAMP           DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id)    REFERENCES users(user_id)       ON DELETE CASCADE,
    FOREIGN KEY (vehicle_id) REFERENCES vehicles(vehicle_id) ON DELETE RESTRICT,

    CHECK (end_date > start_date)
);

-- ---------------------------------------------------------
-- Payments
-- 1:1 with Bookings — each booking has exactly one payment record
-- ---------------------------------------------------------
CREATE TABLE payments (
    payment_id    INT AUTO_INCREMENT PRIMARY KEY,
    booking_id    INT                 NOT NULL UNIQUE,
    amount        DECIMAL(10,2)       NOT NULL,
    payment_method ENUM('card','upi','cash') NOT NULL,
    payment_status ENUM('pending','success','failed','refunded')
                                       NOT NULL DEFAULT 'pending',
    paid_at       TIMESTAMP           NULL,

    FOREIGN KEY (booking_id) REFERENCES bookings(booking_id) ON DELETE CASCADE
);

-- ---------------------------------------------------------
-- Reviews
-- Resolved many-to-many between Users and Vehicles.
-- A real entity (has rating, comment, timestamp) — not a
-- thin join table, unlike Wishlist below.
-- ---------------------------------------------------------
CREATE TABLE reviews (
    review_id     INT AUTO_INCREMENT PRIMARY KEY,
    user_id       INT                 NOT NULL,
    vehicle_id    INT                 NOT NULL,
    rating        TINYINT             NOT NULL,
    comment       TEXT,
    created_at    TIMESTAMP           DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id)    REFERENCES users(user_id)       ON DELETE CASCADE,
    FOREIGN KEY (vehicle_id) REFERENCES vehicles(vehicle_id) ON DELETE CASCADE,

    CHECK (rating BETWEEN 1 AND 5),
    UNIQUE (user_id, vehicle_id)  -- one review per user per vehicle
);

-- ---------------------------------------------------------
-- Wishlist
-- Thin many-to-many join table — no attributes of its own
-- beyond "this user saved this vehicle."
-- ---------------------------------------------------------
CREATE TABLE wishlist (
    user_id       INT                 NOT NULL,
    vehicle_id    INT                 NOT NULL,
    added_at      TIMESTAMP           DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (user_id, vehicle_id),
    FOREIGN KEY (user_id)    REFERENCES users(user_id)       ON DELETE CASCADE,
    FOREIGN KEY (vehicle_id) REFERENCES vehicles(vehicle_id) ON DELETE CASCADE
);

-- ---------------------------------------------------------
-- Indexes for common query patterns
-- (search/filter by category, availability lookups by vehicle+dates)
-- ---------------------------------------------------------
CREATE INDEX idx_vehicles_category   ON vehicles(category_id);
CREATE INDEX idx_vehicles_available  ON vehicles(is_available);
CREATE INDEX idx_bookings_vehicle    ON bookings(vehicle_id, start_date, end_date);
CREATE INDEX idx_bookings_user       ON bookings(user_id);