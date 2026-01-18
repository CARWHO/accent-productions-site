-- Add fields for enhanced job sheet functionality
-- Group 2: Contractor Experience & Job Sheet improvements

-- Call time = when contractor needs to arrive (pack-in time)
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS call_time TEXT;

-- Pack out time = when contractor finishes tear-down
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS pack_out_time TEXT;

-- Room available from = when venue becomes available for setup
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS room_available_from TEXT;

-- Call out notes = admin notes for the job
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS call_out_notes TEXT;

-- Vehicle type = which vehicle is being used for this job
-- Options: personal, company_van, hire, admin_vehicle
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS vehicle_type TEXT;

-- Band names = who is performing (visible to contractors)
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS band_names TEXT;

-- Comments
COMMENT ON COLUMN bookings.call_time IS 'When contractor needs to arrive (pack-in time)';
COMMENT ON COLUMN bookings.pack_out_time IS 'When contractor finishes tear-down';
COMMENT ON COLUMN bookings.room_available_from IS 'When venue becomes available for setup';
COMMENT ON COLUMN bookings.call_out_notes IS 'Admin notes/instructions for the job';
COMMENT ON COLUMN bookings.vehicle_type IS 'Vehicle being used: personal, company_van, hire, admin_vehicle';
COMMENT ON COLUMN bookings.band_names IS 'Band/performer names for the event';
