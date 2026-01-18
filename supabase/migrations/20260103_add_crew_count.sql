-- Add crew count field to bookings table
-- Tracks how many people are working on this event under Accent Productions

ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS crew_count INTEGER DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN bookings.crew_count IS 'Number of crew members working on this event under Accent Productions';
