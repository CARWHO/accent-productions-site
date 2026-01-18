-- Add vehicle payment tracking
-- When vehicle_type = 'personal', the vehicle_amount goes to the assigned contractor

-- Vehicle amount = the $ amount for vehicle usage (from quote lineItems.vehicle)
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS vehicle_amount DECIMAL(10, 2);

-- Vehicle contractor = which contractor gets paid for the vehicle (when using personal vehicle)
-- References booking_contractor_assignments.id (not contractor_id directly)
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS vehicle_contractor_id UUID;

-- Comments
COMMENT ON COLUMN bookings.vehicle_amount IS 'Vehicle payment amount (when personal vehicle is used)';
COMMENT ON COLUMN bookings.vehicle_contractor_id IS 'Assignment ID of contractor who gets vehicle payment';
