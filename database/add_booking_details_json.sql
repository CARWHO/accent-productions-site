-- Add details_json column to store rich booking details for contractor emails
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS details_json JSONB DEFAULT '{}';
