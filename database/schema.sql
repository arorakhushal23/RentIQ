CREATE DATABASE IF NOT EXISTS rentiq;
USE rentiq;

CREATE TABLE users (
    user_id       INT AUTO_INCREMENT PRIMARY KEY,
    name          VARCHAR(100)        NOT NULL,
    email         VARCHAR(150)        NOT NULL UNIQUE,
    password_hash VARCHAR(255)        NOT NULL,
    role          ENUM('customer','admin') NOT NULL DEFAULT 'customer',
    created_at    TIMESTAMP           DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE categories (
    category_id   INT AUTO_INCREMENT PRIMARY KEY,
    name          VARCHAR(50)         NOT NULL UNIQUE
);

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
    UNIQUE (user_id, vehicle_id)
);

CREATE TABLE wishlist (
    user_id       INT                 NOT NULL,
    vehicle_id    INT                 NOT NULL,
    added_at      TIMESTAMP           DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (user_id, vehicle_id),
    FOREIGN KEY (user_id)    REFERENCES users(user_id)       ON DELETE CASCADE,
    FOREIGN KEY (vehicle_id) REFERENCES vehicles(vehicle_id) ON DELETE CASCADE
);

CREATE INDEX idx_vehicles_category   ON vehicles(category_id);
CREATE INDEX idx_vehicles_available  ON vehicles(is_available);
CREATE INDEX idx_bookings_vehicle    ON bookings(vehicle_id, start_date, end_date);
CREATE INDEX idx_bookings_user       ON bookings(user_id);