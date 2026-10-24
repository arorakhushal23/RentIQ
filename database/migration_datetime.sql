-- Migration: Add datetime support to bookings table
-- RentIQ Database Migration
-- Safe backward-compatible migration preserving all existing records and IDs

USE rentiq;

-- 1. Add pickup_datetime and return_datetime columns (initially nullable for safe staged migration)
ALTER TABLE bookings
    ADD COLUMN pickup_datetime DATETIME NULL AFTER vehicle_id,
    ADD COLUMN return_datetime DATETIME NULL AFTER pickup_datetime;

-- 2. Backfill existing bookings with documented interpretation:
-- Existing date-only rentals are interpreted as full 24-hour daily rental cycles
-- starting at 10:00:00 AM on start_date and ending at 10:00:00 AM on end_date,
-- preserving the exact integer rental duration and existing total_price calculations.
UPDATE bookings
SET
    pickup_datetime = CAST(CONCAT(start_date, ' 10:00:00') AS DATETIME),
    return_datetime = CAST(CONCAT(end_date, ' 10:00:00') AS DATETIME)
WHERE pickup_datetime IS NULL;

-- 3. Enforce NOT NULL on the populated datetime columns
ALTER TABLE bookings
    MODIFY COLUMN pickup_datetime DATETIME NOT NULL,
    MODIFY COLUMN return_datetime DATETIME NOT NULL;

-- 4. Allow start_date and end_date to be nullable for backward compatibility with date-only queries
ALTER TABLE bookings
    MODIFY COLUMN start_date DATE NULL,
    MODIFY COLUMN end_date DATE NULL;

-- 5. Drop the old date-only check constraint that prohibited same-day rentals
ALTER TABLE bookings
    DROP CHECK bookings_chk_1;

-- 6. Add new datetime-based check constraint requiring return_datetime > pickup_datetime
ALTER TABLE bookings
    ADD CONSTRAINT bookings_chk_datetime CHECK (return_datetime > pickup_datetime);

-- 7. Replace the date-based vehicle index with a datetime-based index
-- Create the new index first so InnoDB foreign key constraint bookings_ibfk_2 remains satisfied
CREATE INDEX idx_bookings_vehicle_datetime
    ON bookings(vehicle_id, pickup_datetime, return_datetime);

ALTER TABLE bookings
    DROP INDEX idx_bookings_vehicle;
