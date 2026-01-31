-- Rename room_available_from to site_available_from for clarity
-- The field represents when the venue/site opens for setup

ALTER TABLE bookings RENAME COLUMN room_available_from TO site_available_from;

COMMENT ON COLUMN bookings.site_available_from IS 'When venue/site becomes available for setup';
